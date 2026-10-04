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

app.use(express.json({ limit: '10mb' }));

// NVIDIA Build default endpoint
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// API Configuration endpoint
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    hasNvidiaKey: Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY !== 'MY_NVIDIA_API_KEY'),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    defaultModel: 'nvidia/nemotron-3.5-lightning-30b-a3b'
  });
});

// Proxy for NVIDIA Build API
app.post('/api/chat/nvidia', async (req: Request, res: Response) => {
  try {
    const { model, messages, apiKey: clientApiKey, endpoint, temperature = 0.6, max_tokens = 600 } = req.body;

    const apiKey = (clientApiKey && clientApiKey.trim()) || process.env.NVIDIA_API_KEY;
    const targetUrl = (endpoint && endpoint.trim()) || NVIDIA_BASE_URL;

    if (!apiKey || apiKey === 'MY_NVIDIA_API_KEY') {
      // Check if Gemini key is available as intelligent fallback
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        // Format prompt from messages
        const lastMsg = messages?.[messages.length - 1]?.content || 'Hola';
        const systemMsg = messages?.find((m: { role: string; content: string }) => m.role === 'system')?.content || '';
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `${systemMsg ? `[Instrucción del sistema: ${systemMsg}]\n\n` : ''}${lastMsg}`,
        });

        return res.json({
          id: `fallback-gemini-${Date.now()}`,
          choices: [
            {
              message: {
                role: 'assistant',
                content: response.text || 'Respuesta generada con motor alternativo.',
              },
            },
          ],
          model_used: 'gemini-2.5-flash (Fallback)',
          is_fallback: true
        });
      }

      return res.status(401).json({
        error: 'NVIDIA_API_KEY no configurada en el servidor ni provista por el cliente.',
        code: 'MISSING_API_KEY',
        instruction: 'Ingresa tu API Key de NVIDIA Build en Configuración o utiliza el motor local RT Lite (100% offline).'
      });
    }

    const payload = {
      model: model || 'nvidia/nemotron-3.5-lightning-30b-a3b',
      messages,
      temperature,
      max_tokens,
      stream: false
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedErr: any = null;
      try {
        parsedErr = JSON.parse(errText);
      } catch {
        parsedErr = { error: errText };
      }
      return res.status(response.status).json({
        error: parsedErr?.error?.message || parsedErr?.error || `Error NVIDIA API (${response.status})`,
        status: response.status,
        details: parsedErr
      });
    }

    const data = await response.json();
    return res.json({
      ...data,
      model_used: model,
      is_fallback: false
    });

  } catch (error: any) {
    console.error('Error in /api/chat/nvidia:', error);
    return res.status(500).json({
      error: error?.message || 'Error interno al comunicarse con el proveedor del modelo.',
    });
  }
});

// Gemini fallback route
app.post('/api/chat/gemini', async (req: Request, res: Response) => {
  try {
    const { prompt, systemInstruction } = req.body;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
      return res.status(401).json({ error: 'GEMINI_API_KEY no disponible.' });
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || 'Eres VVC-ACIA, un asistente personal de voz altamente eficiente.',
      }
    });

    return res.json({
      text: response.text,
      model_used: 'gemini-2.5-flash'
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
      server: { middlewareMode: true },
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
