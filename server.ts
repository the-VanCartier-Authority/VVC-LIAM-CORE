import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import webpush from 'web-push';
import { createVaosRouter } from './src/server/vaosOrchestrator.ts';
import { ProviderRegistry, providerKey, postProvider, EgressPolicyError, UpstreamError } from './src/server/providerEgress.ts';
import { executionOutcome } from './src/shared/executionOutcome.ts';
import { createFirebaseVerifier, firebaseIdentityMiddleware } from './src/server/firebaseIdentity.ts';
import { BackendLimits, resourceErrorHandler } from './src/server/backendLimits.ts';
import { PushDestinations, PushRegistry, PushError, createPushSender, pushPayload } from './src/server/pushDelivery.ts';
import { providerModel, fallbackSelection, modelProvenance, ModelRoutingError } from './src/shared/modelRouting.ts';

dotenv.config();
const providers = new ProviderRegistry(process.env.LLM_PROVIDERS_JSON || '[]');
const limits = new BackendLimits(process.env.BACKEND_LIMITS_JSON || '{}');

function egressFailure(res: Response, error: unknown) {
  if (error instanceof ModelRoutingError) return res.status(400).json({ success: false,
    code: error.code, error: error.message, outcome: executionOutcome('failed', 'model-selection'), realExecution: false });
  const policy = error instanceof EgressPolicyError;
  return res.status(policy ? 400 : 502).json({ success: false,
    outcome: executionOutcome('failed', 'provider'),
    realExecution: false,
    code: policy ? 'EGRESS_POLICY' : 'UPSTREAM_ERROR',
    error: policy ? 'Destino o credencial no permitido por la política del servidor.' : 'No se pudo completar la petición al proveedor.' });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// The dev server must always bind to port 3000 because NGINX runs on port 8080 and proxies to 3000.
const PORT = process.env.PORT && process.env.PORT !== '8080' ? Number(process.env.PORT) : 3000;

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || JSON.parse(
  readFileSync(new URL('./firebase-applet-config.json', import.meta.url), 'utf8')).projectId;
app.use('/api', firebaseIdentityMiddleware(createFirebaseVerifier(firebaseProjectId)));
app.use('/api', limits.middleware());
app.use(express.json({ limit: '256kb' }));
app.use('/api', limits.payload());

// Mount VAOS Smart Routing Orchestrator (Policy Engine, Fast Path & Async Queue)
app.use('/api/vaos', createVaosRouter(limits));

// Neural voice mapping for application voice profiles
const VOICE_MAP: Record<string, string> = {
  es_mateo: 'Fenrir',   // Male, deep executive obsidian voice
  es_sofia: 'Kore',     // Female, warm natural articulate voice
  es_valeria: 'Kore',   // Female, warm natural articulate voice
  es_camila: 'Zephyr',  // Soft cyberpunk technical voice
  es_lucas: 'Puck',     // Energetic fast agile voice
  af_heart: 'Kore',     // Flagship natural human voice
  af_bella: 'Zephyr',   // Dynamic, expressive female voice
  af_nicole: 'Kore',    // Direct executive female voice
  am_adam: 'Fenrir',    // Deep male voice
  am_michael: 'Charon', // Authoritative male voice
  bf_emma: 'Zephyr',    // British-style articulate voice
  en_sarah: 'Kore',
  en_adam: 'Charon',
};

// Web Push & VAPID Setup for Background Native Push Notifications
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (!vapidPublicKey || !vapidPrivateKey) {
  const generatedKeys = webpush.generateVAPIDKeys();
  vapidPublicKey = generatedKeys.publicKey;
  vapidPrivateKey = generatedKeys.privateKey;
  console.log('[VVC LIAM Push] VAPID keys inicializadas para Web Push en segundo plano.');
}

try {
  webpush.setVapidDetails(
    'mailto:vvc-liam@obsidian.local',
    vapidPublicKey,
    vapidPrivateKey
  );
} catch (vapidErr) {
  console.warn('[VVC LIAM Push] Error configurando VAPID details:', vapidErr);
}

const pushDestinations = new PushDestinations(process.env.PUSH_ADDITIONAL_HOSTS_JSON || '[]');
const pushRegistry = new PushRegistry(pushDestinations, createPushSender(pushDestinations));

// Service Worker & PWA Direct Routes with proper MIME type and scope headers
app.get('/manifest.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.resolve(__dirname, 'public', 'manifest.json'));
});

app.get('/manifest.webmanifest', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.resolve(__dirname, 'public', 'manifest.json'));
});

app.get('/offline.html', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.resolve(__dirname, 'public', 'offline.html'));
});

app.get('/favicon.ico', (_req: Request, res: Response) => {
  res.sendFile(path.resolve(__dirname, 'public', 'favicon.ico'));
});

app.get('/sw.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.resolve(__dirname, 'public', 'sw.js'));
});

app.get('/sw-push.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.resolve(__dirname, 'public', 'sw-push.js'));
});

// Push Notification Endpoints
app.get('/api/push/vapid-public-key', (_req: Request, res: Response) => {
  res.json({ publicKey: vapidPublicKey });
});

function pushFailure(res: Response, error: unknown) {
  return res.status(error instanceof PushError ? error.status : 500).json({ success: false,
    code: error instanceof PushError ? error.code : 'PUSH_FAILED', error: 'No se pudo completar la operación push.' });
}

app.post('/api/push/subscribe', (req: Request, res: Response) => {
  try { return res.json({ success: true, count: pushRegistry.subscribe(req.auth!.uid, req.body) }); }
  catch (error) { return pushFailure(res, error); }
});
app.post('/api/push/unsubscribe', (req: Request, res: Response) => {
  try { return res.json({ success: true, count: pushRegistry.unsubscribe(req.auth!.uid, req.body?.endpoint) }); }
  catch (error) { return pushFailure(res, error); }
});
app.post('/api/push/send', async (req: Request, res: Response) => {
  try {
    const uid = req.auth!.uid;
    const { payload, delayMs } = pushPayload(req.body);
    if (delayMs) {
      pushRegistry.schedule(uid, payload, delayMs);
      return res.status(202).json({ success: true, scheduled: true, delayMs, delivery: 'not_attempted', durable: false });
    }
    const result = await pushRegistry.dispatch(uid, payload);
    return res.json({ success: result.failed === 0, ...result });
  } catch (error) { return pushFailure(res, error); }
});
app.get('/api/push/status', (req: Request, res: Response) => {
  res.json({ enabled: true, hasVapidKey: Boolean(vapidPublicKey), activeSubscribers: pushRegistry.count(req.auth!.uid) });
});

// API Configuration endpoint
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    hasNvidiaKey: Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY !== 'MY_NVIDIA_API_KEY'),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    defaultModel: 'meta/llama-3.2-11b-vision-instruct',
    hasNeuralTTS: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    hasPushEnabled: true,
  });
});

/**
 * Helper to build standard 44-byte RIFF/WAVE header for raw PCM audio
 */
function addWavHeader(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// In-memory TTS Cache for lightning-fast repeat audio responses
const ttsCache = new Map<string, { audio: string; mimeType: string; voiceName: string }>();

// Prioritized list of high-fidelity Neural TTS models
const TTS_MODELS = [
  'gemini-2.5-flash-preview-tts',
  'gemini-3.8-flash-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-pro-preview-tts',
  'gemini-3.8-flash-lite-tts',
];

// Map application voice profiles to the Edge provider
const EDGE_VOICE_MAP: Record<string, string> = {
  es_mateo: 'es-ES-AlvaroNeural',
  es_sofia: 'es-ES-ElviraNeural',
  es_camila: 'es-MX-DaliaNeural',
  es_lucas: 'es-MX-JorgeNeural',
  es_valeria: 'es-US-PalomaNeural',
  es_diego: 'es-CO-GonzaloNeural',
  af_heart: 'en-US-JennyNeural',
  af_bella: 'en-US-AvaNeural',
  af_nicole: 'en-US-EmmaNeural',
  am_adam: 'en-US-GuyNeural',
  am_michael: 'en-US-BrianNeural',
  bf_emma: 'en-GB-SoniaNeural',
  en_sarah: 'en-US-JennyNeural',
  en_adam: 'en-US-GuyNeural',
};

async function generateEdgeTTS(text: string, voiceId: string): Promise<{ audio: string; mimeType: string; voiceName: string }> {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
  const tts = new MsEdgeTTS();
  const voiceName = EDGE_VOICE_MAP[voiceId] || 'es-ES-AlvaroNeural';
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let audioStream: ReturnType<typeof tts.toStream>['audioStream'] | undefined;
    let settled = false, size = 0;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { tts.close(); audioStream?.destroy(); } catch {}
      if (error) reject(error);
      else resolve({ audio: Buffer.concat(chunks).toString('base64'), mimeType: 'audio/mp3', voiceName });
    };
    // Include metadata/socket setup in the deadline, not only audio reception.
    const timeout = setTimeout(() => finish(new Error('EDGE_TTS_TIMEOUT')), 7000);
    tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3).then(() => {
      if (settled) return;
      audioStream = tts.toStream(text).audioStream;
      audioStream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 4 * 1024 * 1024) finish(new Error('EDGE_TTS_SIZE_LIMIT'));
        else chunks.push(chunk);
      });
      audioStream.once('end', () => finish());
      audioStream.once('error', () => finish(new Error('EDGE_TTS_FAILED')));
    }).catch(() => finish(new Error('EDGE_TTS_FAILED')));
  });
}

/**
 * High-Fidelity Studio Neural Voice Synthesis (TTS)
 * Uses configured voice providers subject to quotas, network and browser availability
 */
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, voiceId = 'es_mateo' } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Texto requerido para síntesis de voz.' });
    }

    // Clean text for speech
    const cleanText = text
      .replace(/\[(?:EXEC|E2EE|ALERTA|NOTIF|DISPOSITIVO|CALENDARIO|TAREA)\]/gi, '')
      .replace(/\[\w+[^\]]*\]/g, '')
      .replace(/[`*_~#<>]/g, '')
      .replace(/https?:\/\/\S+/g, 'enlace')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return res.status(400).json({ error: 'Texto vacío tras filtrado.' });
    }

    const cacheKey = `${voiceId}:${cleanText}`;

    // 1. Check in-memory audio cache
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      return res.json({
        audio: cached.audio,
        mimeType: cached.mimeType,
        voiceName: cached.voiceName,
        fallback: false,
        cached: true,
      });
    }

    // 2. Primary Engine: Edge Studio Neural TTS (Ultra-natural, instant, zero quota limitations)
    try {
      const edgeResult = await generateEdgeTTS(cleanText, voiceId);
      if (edgeResult?.audio) {
        if (ttsCache.size > 120) {
          const firstKey = ttsCache.keys().next().value;
          if (firstKey) ttsCache.delete(firstKey);
        }
        ttsCache.set(cacheKey, edgeResult);

        return res.json({
          ...edgeResult,
          fallback: false,
          engine: 'EdgeNeural',
        });
      }
    } catch (edgeErr: any) {
      console.warn('Edge Neural TTS notice, checking Gemini TTS fallback:', edgeErr?.message);
    }

    // 3. Secondary Engine: Gemini Audio Generation (packaged into valid WAV)
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
      const voiceName = VOICE_MAP[voiceId] || 'Fenrir';
      const ai = new GoogleGenAI({ apiKey: geminiKey, httpOptions: { timeout: 6000, retryOptions: { attempts: 1 } } });

      for (const model of TTS_MODELS) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('GEMINI_TTS_TIMEOUT')), 6000)
          );

          const generatePromise = ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: cleanText }] }],
            config: {
              responseModalities: ['AUDIO'],
              maxOutputTokens: 4096,
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
            },
          });

          const response: any = await Promise.race([generatePromise, timeoutPromise]);
          const candidate = response.candidates?.[0]?.content?.parts?.[0];
          const rawBase64 = candidate?.inlineData?.data;

          if (rawBase64) {
            const rawBuffer = Buffer.from(rawBase64, 'base64');
            const isAlreadyWav = rawBuffer.length > 12 && rawBuffer.subarray(0, 4).toString() === 'RIFF';
            const finalBuffer = isAlreadyWav ? rawBuffer : addWavHeader(rawBuffer, 24000, 1, 16);

            const resultData = {
              audio: finalBuffer.toString('base64'),
              mimeType: 'audio/wav',
              voiceName,
            };

            ttsCache.set(cacheKey, resultData);
            return res.json({
              ...resultData,
              fallback: false,
              engine: 'GeminiNeural',
            });
          }
        } catch {
          // Continue to next model
        }
      }
    }

    return res.json({ fallback: true, reason: 'NEURAL_TTS_UNAVAILABLE' });
  } catch (error: any) {
    return res.json({ fallback: true, error: error?.message || 'TTS_FALLBACK' });
  }
});

/**
 * Helper to generate response using Gemini Flash
 */
async function generateGeminiReply(systemMsg: string, userMsg: string, apiKey: string, modelName = 'gemini-2.5-flash') {
  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 30000, retryOptions: { attempts: 1 } } });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `${systemMsg ? `[Instrucción del sistema: ${systemMsg}]\n\n` : ''}${userMsg}`,
      config: { maxOutputTokens: 4096 },
    });
    if (!response.text?.trim()) throw new UpstreamError();
    return response.text;
  } catch (err: any) {
    console.warn('Gemini request notice: upstream request failed');
    throw new UpstreamError();
  }
}

/**
 * Clean thinking / reasoning tokens from model output
 */
function cleanModelResponse(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText;

  // Remove <think>...</think> blocks
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // If text starts with "Here's a thinking process: ...", extract the actual final text
  if (/^Here's a thinking process:/i.test(cleaned)) {
    const doubleLine = cleaned.indexOf('\n\n');
    if (doubleLine !== -1) {
      const candidate = cleaned.slice(doubleLine).trim();
      if (candidate.length > 10) {
        cleaned = candidate;
      }
    }
  }

  // Remove common thinking prefixes
  cleaned = cleaned.replace(/^Output:\s*/i, '').trim();

  return cleaned || rawText;
}

// NVIDIA proxy. A different model/provider requires explicit fallback selection.
app.post('/api/chat/nvidia', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const { model, messages, apiKey: clientApiKey, geminiApiKey: clientGeminiApiKey, temperature = 0.6, max_tokens = 800 } = req.body;

    const provider = providers.select('nvidia', req.body);
    const selectedModel = providerModel('nvidia', model ?? 'meta/llama-3.2-11b-vision-instruct');
    const fallback = fallbackSelection(req.body.fallback);
    const apiKey = providerKey(provider, clientApiKey);
    const geminiKey = fallback === 'gemini-flash' ? providerKey(providers.select('gemini', {}), clientGeminiApiKey) : '';

    const lastMsg = messages?.[messages.length - 1]?.content || 'Hola';
    const systemMsg = messages?.find((m: { role: string; content: string }) => m.role === 'system')?.content || '';

    // A configured Gemini key alone never authorizes replacing the chosen NIM.
    if (!apiKey) {
      if (geminiKey) {
        const text = await generateGeminiReply(systemMsg, lastMsg, geminiKey, 'gemini-2.5-flash');
        return res.json({
          id: `fallback-gemini-${Date.now()}`,
          choices: [{ message: { role: 'assistant', content: text } }],
          ...modelProvenance('gemini', selectedModel, 'gemini-2.5-flash'),
          is_fallback: true,
          outcome: executionOutcome('generated', 'gemini'),
          realExecution: false,
        });
      }

      return res.status(401).json({
        error: 'Se requiere una API Key de NVIDIA para utilizar modelos en la nube. Configura tu clave secreta o utiliza un motor local RT-Lite On-Device.',
        code: 'MISSING_API_KEY',
        requiresKey: 'nvidia',
        outcome: executionOutcome('unavailable', 'nvidia'),
        realExecution: false,
      });
    }

    // Adaptive token allocation and timeout based on model architecture
    const isCodingModel =
      selectedModel.includes('coder') ||
      selectedModel.includes('codestral') ||
      selectedModel.includes('codellama') ||
      selectedModel.includes('starcoder') ||
      selectedModel.includes('laguna');

    const isDeepReasoning =
      selectedModel === 'z-ai/glm-5-3' || // GLM-5.3 Flagship Full Engine
      selectedModel.includes('deepseek-r1') ||
      selectedModel.includes('deepseek-v3') ||
      selectedModel.includes('nemotron-3-ultra') ||
      selectedModel.includes('405b') ||
      selectedModel.includes('nemotron-70b') ||
      selectedModel.includes('mistral-large');

    let dynamicMaxTokens = max_tokens;
    if (isCodingModel) {
      dynamicMaxTokens = Math.max(max_tokens, 4096);
    } else if (isDeepReasoning) {
      dynamicMaxTokens = Math.max(max_tokens, 3500);
    } else if (selectedModel.includes('nemotron')) {
      dynamicMaxTokens = Math.max(max_tokens, 2048);
    }

    const payload = {
      model: selectedModel,
      messages,
      temperature,
      max_tokens: dynamicMaxTokens,
      stream: false,
    };

    try {
      // Extended timeout for deep reasoning and massive code generation
      const timeoutDuration = (isDeepReasoning || isCodingModel) ? 60000 : 30000;
      const response = await postProvider(provider, apiKey, payload, timeoutDuration);

      if (response.ok) {
        const data = await response.json();
        const msg = data.choices?.[0]?.message;
        let rawContent = msg?.content || '';

        // If content is empty but reasoning_content exists (e.g. DeepSeek R1 or GLM-5.3 CoT)
        if (!rawContent && msg?.reasoning_content) {
          rawContent = msg.reasoning_content;
        }

        const cleanedContent = cleanModelResponse(rawContent);

        if (cleanedContent && cleanedContent.length > 0) {
          if (data.choices?.[0]?.message) {
            data.choices[0].message.content = cleanedContent;
          }
          return res.json({
            ...data,
            ...modelProvenance(provider.id, selectedModel, selectedModel, data.model),
            is_fallback: false,
            outcome: executionOutcome('generated', provider.id),
            realExecution: false,
          });
        }
      }

      // Only the explicitly requested backup may replace a failed model.
      if (fallback === 'nvidia-fast' && selectedModel !== 'meta/llama-3.2-11b-vision-instruct') {
        try {
          const fastRes = await postProvider(provider, apiKey, {
              ...payload,
              model: 'meta/llama-3.2-11b-vision-instruct',
              max_tokens: 800,
            }, 10000);
          if (fastRes.ok) {
            const fastData = await fastRes.json();
            const fastText = cleanModelResponse(fastData.choices?.[0]?.message?.content || '');
            if (fastText) {
              fastData.choices[0].message.content = fastText;
              return res.json({
                ...fastData,
                ...modelProvenance(provider.id, selectedModel, 'meta/llama-3.2-11b-vision-instruct', fastData.model),
                is_fallback: true,
                outcome: executionOutcome('generated', provider.id),
                realExecution: false,
              });
            }
          }
        } catch (error) {
          if (error instanceof EgressPolicyError) throw error;
        }
      }
    } catch (fetchErr: unknown) {
      if (fetchErr instanceof EgressPolicyError) throw fetchErr;
      console.warn('NVIDIA request notice: upstream request failed');
    }

    // Cross-provider fallback uses its own credential and truthful provenance.
    if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
      const text = await generateGeminiReply(systemMsg, lastMsg, geminiKey);
      return res.json({
        id: `auto-backup-${Date.now()}`,
        choices: [{ message: { role: 'assistant', content: text } }],
        ...modelProvenance('gemini', selectedModel, 'gemini-2.5-flash'),
        is_fallback: true,
        outcome: executionOutcome('generated', 'gemini'),
        realExecution: false,
      });
    }

    return egressFailure(res, new UpstreamError());
  } catch (error: any) {
    return egressFailure(res, error);
  }
});

// Gemini direct route with full client API Key support and model choice
app.post('/api/chat/gemini', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const { prompt, systemInstruction, messages, apiKey: clientApiKey, model = 'gemini-2.5-flash' } = req.body;
    const targetModel = providerModel('gemini', model);
    const apiKey = providerKey(providers.select('gemini', req.body), clientApiKey);

    if (!apiKey) {
      return res.status(401).json({
        error: 'Se requiere una API Key de Google Gemini para utilizar este modelo. Ingrésala en la Bóveda de Secretos.',
        code: 'MISSING_API_KEY',
        requiresKey: 'gemini',
        outcome: executionOutcome('unavailable', 'gemini'),
        realExecution: false,
      });
    }

    const lastMsg = prompt || messages?.[messages.length - 1]?.content || 'Hola';
    const sysMsg = systemInstruction || messages?.find((m: { role: string; content: string }) => m.role === 'system')?.content || '';

    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 30000, retryOptions: { attempts: 1 } } });
    const fullContents = sysMsg ? `[Instrucción del sistema: ${sysMsg}]\n\n${lastMsg}` : lastMsg;
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: fullContents,
      config: { maxOutputTokens: 4096 },
    });

    const responseText = cleanModelResponse(response.text || '');
    if (!responseText.trim()) throw new UpstreamError();

    return res.json({
      id: `gemini-${Date.now()}`,
      choices: [{ message: { role: 'assistant', content: responseText } }],
      ...modelProvenance('gemini', model, targetModel, response.modelVersion),
      text: responseText,
      outcome: executionOutcome('generated', 'gemini'),
      realExecution: false,
    });
  } catch (error: any) {
    return egressFailure(res, error);
  }
});

// Custom LLM Proxy (OpenAI / Groq / OpenRouter / Together / Ollama)
app.post('/api/chat/custom', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const { apiKey, model, messages, temperature = 0.6, max_tokens = 1000 } = req.body;

    const provider = providers.select('custom', req.body);
    const key = providerKey(provider, apiKey);

    const targetModel = model?.trim() || 'default';
    const response = await postProvider(provider, key, {
        model: targetModel,
        messages,
        temperature,
        max_tokens,
      });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Error en proveedor personalizado (${response.status}).`,
        outcome: executionOutcome('failed', provider.id),
        realExecution: false,
      });
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || data.text || '';
    const cleaned = cleanModelResponse(rawContent);
    if (!cleaned.trim()) throw new UpstreamError();

    return res.json({
      ...data,
      choices: [{ message: { role: 'assistant', content: cleaned } }],
      ...modelProvenance(provider.id, targetModel, targetModel, data.model),
      outcome: executionOutcome('generated', provider.id),
      realExecution: false,
    });
  } catch (error: any) {
    return egressFailure(res, error);
  }
});

// Test API Key / Secret endpoint
app.post('/api/secrets/test', async (req: Request, res: Response) => {
  const { provider, apiKey, model } = req.body;
  try {
    if (provider === 'gemini') {
      const key = providerKey(providers.select('gemini', req.body), apiKey);
      if (!key) return res.status(400).json({ success: false, error: 'Clave no proporcionada' });
      const ai = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 30000, retryOptions: { attempts: 1 } } });
      const testRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Ping',
        config: { maxOutputTokens: 4096 },
      });
      return res.json({ success: true, message: 'Google Gemini API Key verificada con éxito', ping: testRes.text?.slice(0, 50) });
    }

    if (provider === 'nvidia') {
      const target = providers.select('nvidia', req.body);
      const key = providerKey(target, apiKey);
      if (!key) return res.status(400).json({ success: false, error: 'Clave no proporcionada' });
      const resp = await postProvider(target, key, {
          model: 'meta/llama-3.2-11b-vision-instruct',
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 10,
        });
      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, error: `Error NVIDIA (${resp.status}).` });
      }
      return res.json({ success: true, message: 'NVIDIA NIM API Key verificada con éxito' });
    }

    if (provider === 'custom') {
      const target = providers.select('custom', req.body);
      const key = providerKey(target, apiKey);
      const resp = await postProvider(target, key, {
          model: model || 'test',
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 10,
        });
      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, error: `Error proveedor (${resp.status}).` });
      }
      return res.json({ success: true, message: 'Endpoint personalizado verificado con éxito' });
    }

    return res.status(400).json({ success: false, error: 'Proveedor no soportado' });
  } catch (err: any) {
    return egressFailure(res, err);
  }
});

app.use(resourceErrorHandler);

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VVC LIAM CORE] Obsidian Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
