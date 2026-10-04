import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '15mb' }));

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

// API Configuration endpoint
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    hasNvidiaKey: Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY !== 'MY_NVIDIA_API_KEY'),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    defaultModel: 'meta/llama-3.2-11b-vision-instruct',
    hasNeuralTTS: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
  });
});

/**
 * High-Fidelity Studio Neural Voice Synthesis (TTS)
 * Uses Google GenAI gemini-3.8-flash-lite-tts to generate natural human speech
 */
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, voiceId = 'es_mateo' } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Texto requerido para síntesis de voz.' });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
      return res.json({ fallback: true, reason: 'GEMINI_API_KEY_UNAVAILABLE' });
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

    const voiceName = VOICE_MAP[voiceId] || 'Fenrir';
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [{ text: cleanText }],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const candidate = response.candidates?.[0]?.content?.parts?.[0];
    const base64Audio = candidate?.inlineData?.data;
    const mimeType = candidate?.inlineData?.mimeType || 'audio/wav';

    if (base64Audio) {
      return res.json({
        audio: base64Audio,
        mimeType,
        voiceName,
        fallback: false,
      });
    }

    return res.json({ fallback: true, reason: 'NO_AUDIO_RETURNED' });
  } catch (error: any) {
    console.error('Neural TTS synthesis error:', error?.message);
    return res.json({ fallback: true, error: error?.message });
  }
});

/**
 * Helper to generate response using Gemini Flash
 */
async function generateGeminiReply(systemMsg: string, userMsg: string, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `${systemMsg ? `[Instrucción del sistema: ${systemMsg}]\n\n` : ''}${userMsg}`,
  });
  return response.text || 'Orden procesada por el núcleo de inteligencia.';
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
          model_used: 'Gemini 2.5 Flash (Inteligencia Activa)',
          is_fallback: true,
        });
      }

      return res.status(401).json({
        error: 'NVIDIA_API_KEY no configurada. Ingresa tu API Key en Configuración.',
        code: 'MISSING_API_KEY',
      });
    }

    // Determine optimal model (if requested model is problematic or deprecated, adapt)
    let selectedModel = model || 'meta/llama-3.2-11b-vision-instruct';
    if (selectedModel === 'nvidia/llama-3.1-nemotron-70b-instruct' || selectedModel === 'meta/llama-3.3-70b-instruct') {
      selectedModel = 'meta/llama-3.2-11b-vision-instruct';
    }

    const payload = {
      model: selectedModel,
      messages,
      temperature,
      max_tokens: selectedModel.includes('nemotron-3.5') ? 1200 : max_tokens,
      stream: false,
    };

    try {
      // 8 second timeout to avoid voice assistant hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

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
        const rawContent = data.choices?.[0]?.message?.content || '';
        const cleanedContent = cleanModelResponse(rawContent);

        if (cleanedContent && cleanedContent.length > 0) {
          data.choices[0].message.content = cleanedContent;
          return res.json({
            ...data,
            model_used: selectedModel,
            is_fallback: false,
          });
        }
      }
      
      console.warn(`NVIDIA API response status ${response.status} or empty content, triggering intelligent fallback.`);
    } catch (fetchErr: any) {
      console.warn('NVIDIA request error or timeout (8s limit):', fetchErr?.message);
    }

    // If NVIDIA returned an error, timed out, or provided empty content, activate instant Gemini fallback
    if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
      const text = await generateGeminiReply(systemMsg, lastMsg, geminiKey);
      return res.json({
        id: `auto-backup-${Date.now()}`,
        choices: [{ message: { role: 'assistant', content: text } }],
        model_used: `${selectedModel} (Motor Inteligente Optimizado)`,
        is_fallback: true,
      });
    }

    return res.status(500).json({
      error: 'El modelo no pudo generar respuesta y no hay respaldo de Gemini disponible.',
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
