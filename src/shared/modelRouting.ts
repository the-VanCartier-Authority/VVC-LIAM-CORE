import { AVAILABLE_MODELS } from '../types/index.ts';

export type ModelProvider = 'nvidia' | 'gemini' | 'custom' | 'local' | 'direct';
export class ModelRoutingError extends Error {
  readonly code: string;
  constructor(code = 'MODEL_PROVIDER_MISMATCH') {
    super('El modelo solicitado no corresponde al proveedor o configuración seleccionados.'); this.code = code;
  }
}
const providers = {
  'NVIDIA NIM': 'nvidia', 'Google Gemini': 'gemini', 'Custom LLM': 'custom',
  'RT-Lite Local': 'local', 'Direct Execution': 'direct',
} as const;

// A model namespace describes its publisher, not its inference provider.
export function catalogModelProvider(model: unknown): ModelProvider | undefined {
  const entry = AVAILABLE_MODELS.find(entry => entry.id === model);
  return entry ? providers[entry.category] : undefined;
}
export function cloudModelProvider(model: unknown): 'nvidia' | 'gemini' | 'custom' {
  const provider = catalogModelProvider(model);
  if (!provider || provider === 'local' || provider === 'direct') throw new ModelRoutingError('INVALID_MODEL');
  return provider;
}
export function providerModel(provider: 'nvidia' | 'gemini', input: unknown): string {
  if (typeof input !== 'string' || !input.trim() || input.length > 200 || /[\s\x00-\x1f]/.test(input))
    throw new ModelRoutingError('INVALID_MODEL');
  if (provider === 'gemini') {
    const match = /^(?:google\/)?(gemini-[a-zA-Z0-9][a-zA-Z0-9._-]*)$/.exec(input);
    if (!match) throw new ModelRoutingError();
    return match[1];
  }
  const known = catalogModelProvider(input);
  if ((known && known !== 'nvidia') || /^(?:google\/)?gemini-/.test(input)) throw new ModelRoutingError();
  return input;
}
export function fallbackSelection(input: unknown): 'none' | 'nvidia-fast' | 'gemini-flash' {
  if (input === undefined) return 'none';
  if (input !== 'none' && input !== 'nvidia-fast' && input !== 'gemini-flash') throw new ModelRoutingError('INVALID_FALLBACK');
  return input;
}
export function modelProvenance(providerId: string, requested: string, target: string, reported?: unknown) {
  const report = typeof reported === 'string' && reported.length <= 200 && reported.trim() ? reported : null;
  return { provider_id: providerId, requested_model: requested, target_model: target,
    reported_model: report, model_used: report || target,
    model_source: report ? 'provider_reported' : 'requested_only' };
}
