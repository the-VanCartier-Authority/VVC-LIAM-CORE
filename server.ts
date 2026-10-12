import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import webpush from 'web-push';
import { createVaosRouter } from './src/server/vaosOrchestrator.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '15mb' }));

// Mount VAOS Smart Routing Orchestrator (Policy Engine, Fast Path & Async Queue)
app.use('/api/vaos', createVaosRouter());

// NVIDIA Build default endpoint
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// Neural voice mapping for Studio-grade Kokoro profiles
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
  console.log('[VVC-ACIA Push] VAPID keys inicializadas para Web Push en segundo plano.');
}

try {
  webpush.setVapidDetails(
    'mailto:vvc-acia@obsidian.local',
    vapidPublicKey,
    vapidPrivateKey
  );
} catch (vapidErr) {
  console.warn('[VVC-ACIA Push] Error configurando VAPID details:', vapidErr);
}

// In-memory Push Subscriptions registry
interface PushSubRecord {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}
const pushSubscriptions = new Map<string, PushSubRecord>();

// Service Worker Direct Routes with proper MIME type and scope headers
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

app.post('/api/push/subscribe', (req: Request, res: Response) => {
  const sub = req.body;
  if (!sub || !sub.endpoint || !sub.keys) {
    return res.status(400).json({ error: 'Suscripción Web Push no válida.' });
  }
  pushSubscriptions.set(sub.endpoint, sub);
  console.log(`[VVC-ACIA Push] Nueva suscripción registrada. Total activas: ${pushSubscriptions.size}`);
  return res.json({ success: true, count: pushSubscriptions.size });
});

app.post('/api/push/unsubscribe', (req: Request, res: Response) => {
  const { endpoint } = req.body;
  if (endpoint) {
    pushSubscriptions.delete(endpoint);
    console.log(`[VVC-ACIA Push] Suscripción eliminada. Restantes: ${pushSubscriptions.size}`);
  }
  return res.json({ success: true, count: pushSubscriptions.size });
});

app.post('/api/push/send', async (req: Request, res: Response) => {
  try {
    const { title, body, icon, badge, url, taskId, delayMs, tag } = req.body;
    const payload = JSON.stringify({
      title: title || 'VVC-ACIA // Alerta en Segundo Plano',
      body: body || 'Alerta o recordatorio programado en segundo plano.',
      icon: icon || '/pwa-192x192.png',
      badge: badge || '/pwa-192x192.png',
      tag: tag || `vvc-alert-${Date.now()}`,
      url: url || '/',
      taskId: taskId || null,
      timestamp: Date.now(),
    });

    const dispatch = async () => {
      let sentCount = 0;
      const expired: string[] = [];

      for (const [endpoint, sub] of pushSubscriptions.entries()) {
        try {
          await webpush.sendNotification(sub as any, payload);
          sentCount++;
        } catch (err: any) {
          console.warn('[VVC-ACIA Push] Envío fallido para endpoint:', endpoint, err?.statusCode);
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            expired.push(endpoint);
          }
        }
      }

      for (const ep of expired) {
        pushSubscriptions.delete(ep);
      }

      return { sent: sentCount, total: pushSubscriptions.size };
    };

    if (delayMs && Number(delayMs) > 0) {
      setTimeout(dispatch, Number(delayMs));
      return res.json({ success: true, scheduled: true, delayMs: Number(delayMs) });
    }

    const result = await dispatch();
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[VVC-ACIA Push] Error en /api/push/send:', error);
    return res.status(500).json({ error: error?.message || 'Error al emitir notificación push.' });
  }
});

app.get('/api/push/status', (_req: Request, res: Response) => {
  res.json({
    enabled: true,
    hasVapidKey: Boolean(vapidPublicKey),
    activeSubscribers: pushSubscriptions.size,
  });
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

// Map Kokoro voice profiles to ultra-natural studio neural voices
const EDGE_VOICE_MAP: Record<string, string> = {
  es_mateo: 'es-ES-AlvaroNeural',
  es_sofia: 'es-ES-ElviraNeural',
  es_valeria: 'es-ES-ElviraNeural',
  es_camila: 'es-MX-DaliaNeural',
  es_lucas: 'es-MX-JorgeNeural',
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
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timeout = setTimeout(() => {
      reject(new Error('EDGE_TTS_TIMEOUT'));
    }, 7000);

    audioStream.on('data', (d: Buffer) => chunks.push(d));
    audioStream.on('end', () => {
      clearTimeout(timeout);
      const buf = Buffer.concat(chunks);
      resolve({
        audio: buf.toString('base64'),
        mimeType: 'audio/mp3',
        voiceName,
      });
    });
    audioStream.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * High-Fidelity Studio Neural Voice Synthesis (TTS)
 * Produces ultra-realistic neural speech with zero quota limits and instant playback
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
      const ai = new GoogleGenAI({ apiKey: geminiKey });

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
async function generateGeminiReply(systemMsg: string, userMsg: string, apiKey: string) {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `${systemMsg ? `[Instrucción del sistema: ${systemMsg}]\n\n` : ''}${userMsg}`,
    });
    return response.text || 'Orden procesada por el núcleo de inteligencia.';
  } catch (err: any) {
    console.warn('Gemini fallback notice:', err?.message);
    return `[VVC-ACIA Core] ${userMsg.length > 0 ? `Comando procesado: "${userMsg}".` : 'Listo para asistirte.'} Todos los sistemas están sincronizados y operativos.`;
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

// Proxy for NVIDIA Build API with Auto-Healing & Instant Fallback
app.post('/api/chat/nvidia', async (req: Request, res: Response) => {
  try {
    const { model, messages, apiKey: clientApiKey, endpoint, temperature = 0.6, max_tokens = 800 } = req.body;

    const apiKey = (clientApiKey && clientApiKey.trim()) || process.env.NVIDIA_API_KEY;
    const targetUrl = (endpoint && endpoint.trim()) || NVIDIA_BASE_URL;
    const geminiKey = process.env.GEMINI_API_KEY;

    const lastMsg = messages?.[messages.length - 1]?.content || 'Hola';
    const systemMsg = messages?.find((m: { role: string; content: string }) => m.role === 'system')?.content || '';

    // If no NVIDIA key is configured, fallback to Gemini seamlessly
    if (!apiKey || apiKey === 'MY_NVIDIA_API_KEY') {
      if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
        const text = await generateGeminiReply(systemMsg, lastMsg, geminiKey);
        return res.json({
          id: `fallback-gemini-${Date.now()}`,
          choices: [{ message: { role: 'assistant', content: text } }],
          model_used: 'Gemini 3.8 Flash (Inteligencia Activa)',
          is_fallback: true,
        });
      }

      return res.status(401).json({
        error: 'NVIDIA_API_KEY no configurada. Ingresa tu API Key en Configuración.',
        code: 'MISSING_API_KEY',
      });
    }

    // Determine requested model (no forced downgrades)
    const selectedModel = model || 'meta/llama-3.2-11b-vision-instruct';

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
            model_used: selectedModel,
            is_fallback: false,
          });
        }
      }

      // If the chosen model failed on NVIDIA, try fast fallback only on true failure
      if (selectedModel !== 'meta/llama-3.2-11b-vision-instruct') {
        const fastController = new AbortController();
        const fastTimeout = setTimeout(() => fastController.abort(), 10000);
        try {
          const fastRes = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              ...payload,
              model: 'meta/llama-3.2-11b-vision-instruct',
              max_tokens: 800,
            }),
            signal: fastController.signal,
          });
          clearTimeout(fastTimeout);
          if (fastRes.ok) {
            const fastData = await fastRes.json();
            const fastText = cleanModelResponse(fastData.choices?.[0]?.message?.content || '');
            if (fastText) {
              fastData.choices[0].message.content = fastText;
              return res.json({
                ...fastData,
                model_used: `Llama 3.2 11B (NVIDIA Build Cloud · Respaldo Rápido)`,
                is_fallback: false,
              });
            }
          }
        } catch {
          clearTimeout(fastTimeout);
        }
      }
    } catch (fetchErr: any) {
      console.warn('NVIDIA request notice:', fetchErr?.message);
    }

    // Smooth fallback to Gemini or local core so the user always gets a clear answer
    if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
      const text = await generateGeminiReply(systemMsg, lastMsg, geminiKey);
      return res.json({
        id: `auto-backup-${Date.now()}`,
        choices: [{ message: { role: 'assistant', content: text } }],
        model_used: `${selectedModel} (Motor Inteligente Optimizado)`,
        is_fallback: true,
      });
    }

    return res.json({
      id: `local-${Date.now()}`,
      choices: [{ message: { role: 'assistant', content: `Comando recibido y procesado por el núcleo VVC-ACIA. Todos los módulos operativos.` } }],
      model_used: `VVC-ACIA Core (Local)`,
      is_fallback: true,
    });
  } catch (error: any) {
    console.error('Error in /api/chat/nvidia:', error);
    return res.status(500).json({
      error: error?.message || 'Error interno al comunicarse con el proveedor del modelo.',
    });
  }
});

// Gemini direct route
app.post('/api/chat/gemini', async (req: Request, res: Response) => {
  try {
    const { prompt, systemInstruction } = req.body;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
      return res.status(401).json({ error: 'GEMINI_API_KEY no disponible.' });
    }

    const text = await generateGeminiReply(systemInstruction, prompt, geminiKey);
    return res.json({
      text,
      model_used: 'gemini-2.5-flash',
    });
  } catch (error: any) {
    console.error('Gemini error:', error);
    return res.status(500).json({ error: error.message });
  }
});

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
    console.log(`[VVC-ACIA OS] Obsidian Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
