/**
 * VVC LIAM CORE - Secrets & API Key Manager
 * Local plaintext API credential storage; encryption and controlled migration remain pending.
 * No hardcoded keys or vendor lock-in: user controls all secrets.
 */

export type SecretKeyId =
  | 'gemini_api_key'
  | 'nvidia_api_key'
  | 'custom_api_key'
  | 'custom_endpoint'
  | 'custom_model'
  | 'webhook_url'
  | 'notion_api_key'
  | 'todoist_api_key';

export interface SecretMetadata {
  id: SecretKeyId;
  name: string;
  provider: 'Google AI' | 'NVIDIA Build' | 'Custom LLM / OpenAI' | 'Integraciones';
  description: string;
  requiredFor: string;
  placeholder: string;
  isSensitive: boolean;
  docUrl?: string;
  badge: string;
}

export const SECRETS_REGISTRY: SecretMetadata[] = [
  {
    id: 'gemini_api_key',
    name: 'Google Gemini API Key',
    provider: 'Google AI',
    description: 'Permite ejecutar modelos Gemini 2.5 Flash, Gemini 2.5 Pro y síntesis de voz Neural TTS con latencia ultrabaja.',
    requiredFor: 'Modelos Gemini en la nube & Síntesis Neural',
    placeholder: 'AIzaSy...',
    isSensitive: true,
    docUrl: 'https://aistudio.google.com/app/apikey',
    badge: 'GOOGLE AI',
  },
  {
    id: 'nvidia_api_key',
    name: 'NVIDIA NIM API Key',
    provider: 'NVIDIA Build',
    description: 'Acceso a catálogo de modelos abiertos en la nube NVIDIA Build (Llama 3.2, Nemotron 3.5, GLM-5.3, DeepSeek R1, Qwen Coder).',
    requiredFor: 'Modelos de la familia NVIDIA NIM',
    placeholder: 'nvapi-...',
    isSensitive: true,
    docUrl: 'https://build.nvidia.com',
    badge: 'NVIDIA NIM',
  },
  {
    id: 'custom_api_key',
    name: 'Custom LLM API Key',
    provider: 'Custom LLM / OpenAI',
    description: 'Clave para cualquier proveedor compatible con OpenAI (Groq, OpenRouter, Together AI, Mistral, Ollama con API Key).',
    requiredFor: 'Endpoints personalizados de LLM',
    placeholder: 'gsk_... / sk-...',
    isSensitive: true,
    badge: 'OPENAI COMPATIBLE',
  },
  {
    id: 'custom_endpoint',
    name: 'Custom LLM Base Endpoint URL',
    provider: 'Custom LLM / OpenAI',
    description: 'URL base del servidor de inferencia compatible con OpenAI.',
    requiredFor: 'Modelos externos o locales (Ollama, vLLM, Groq)',
    placeholder: 'https://api.groq.com/openai/v1/chat/completions',
    isSensitive: false,
    badge: 'ENDPOINT URL',
  },
  {
    id: 'custom_model',
    name: 'Custom Model ID / Name',
    provider: 'Custom LLM / OpenAI',
    description: 'Nombre del modelo a solicitar en el endpoint personalizado (ej: llama-3.3-70b-versatile, gpt-4o, mistral-large).',
    requiredFor: 'Especificación de modelo custom',
    placeholder: 'llama-3.3-70b-versatile',
    isSensitive: false,
    badge: 'MODEL ID',
  },
  {
    id: 'webhook_url',
    name: 'Webhook de Automatización Externa',
    provider: 'Integraciones',
    description: 'URL de webhook para emitir eventos de tareas, agenda o alertas (Slack, Discord, Zapier, Make).',
    requiredFor: 'Integraciones por Webhook',
    placeholder: 'https://hooks.slack.com/services/...',
    isSensitive: false,
    badge: 'WEBHOOK',
  },
  {
    id: 'notion_api_key',
    name: 'Notion Integration Secret Key',
    provider: 'Integraciones',
    description: 'Token de integración interna de Notion para sincronizar bases de datos de tareas.',
    requiredFor: 'Sincronización bidireccional con Notion',
    placeholder: 'secret_...',
    isSensitive: true,
    docUrl: 'https://www.notion.so/my-integrations',
    badge: 'NOTION',
  },
  {
    id: 'todoist_api_key',
    name: 'Todoist API Token',
    provider: 'Integraciones',
    description: 'Token de acceso personal de Todoist para sincronización en tiempo real.',
    requiredFor: 'Sincronización con Todoist',
    placeholder: '0123456789abcdef...',
    isSensitive: true,
    docUrl: 'https://todoist.com/app/settings/integrations/developer',
    badge: 'TODOIST',
  },
];

const STORAGE_PREFIX = 'vvc_secret_';

export class SecretsService {
  public static getSecret(id: SecretKeyId): string {
    try {
      // Check specific secrets key first
      const val = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
      if (val) return val;

      // Backward compatibility with legacy storage keys
      if (id === 'nvidia_api_key') {
        const legacy = localStorage.getItem('vvc_liam_nvidia_key');
        if (legacy) return legacy;
      }
      if (id === 'custom_endpoint') {
        const legacy = localStorage.getItem('vvc_liam_endpoint');
        if (legacy) return legacy;
      }
      if (id === 'webhook_url') {
        const legacy = localStorage.getItem('vvc_liam_webhook');
        if (legacy) return legacy;
      }
      return '';
    } catch {
      return '';
    }
  }

  public static setSecret(id: SecretKeyId, value: string): void {
    try {
      const clean = value.trim();
      if (!clean) {
        localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
      } else {
        localStorage.setItem(`${STORAGE_PREFIX}${id}`, clean);
      }

      // Sync legacy keys with VVC LIAM prefix
      if (id === 'nvidia_api_key') {
        if (!clean) {
          localStorage.removeItem('vvc_liam_nvidia_key');
        } else {
          localStorage.setItem('vvc_liam_nvidia_key', clean);
        }
      }
      if (id === 'custom_endpoint') {
        if (!clean) {
          localStorage.removeItem('vvc_liam_endpoint');
        } else {
          localStorage.setItem('vvc_liam_endpoint', clean);
        }
      }
      if (id === 'webhook_url') {
        if (!clean) {
          localStorage.removeItem('vvc_liam_webhook');
        } else {
          localStorage.setItem('vvc_liam_webhook', clean);
        }
      }
    } catch (e) {
      console.warn('[SecretsService] Error saving secret:', e);
    }
  }

  public static hasSecret(id: SecretKeyId): boolean {
    const val = this.getSecret(id);
    return Boolean(val && val.length > 2);
  }

  public static removeSecret(id: SecretKeyId): void {
    this.setSecret(id, '');
  }

  public static getMaskedSecret(id: SecretKeyId): string {
    const val = this.getSecret(id);
    if (!val) return 'No configurado';
    if (val.length <= 8) return '••••••••';
    return `${val.slice(0, 4)}••••${val.slice(-4)}`;
  }

  public static getAllSecrets(): Record<SecretKeyId, string> {
    const result = {} as Record<SecretKeyId, string>;
    for (const item of SECRETS_REGISTRY) {
      result[item.id] = this.getSecret(item.id);
    }
    return result;
  }
}
