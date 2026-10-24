export class ChatInputError extends Error {
  readonly code = 'CHAT_INPUT';
  constructor(message: string) { super(message); }
}
const invalid = (message: string): never => { throw new ChatInputError(message); };
type Message = { role: 'system' | 'user' | 'assistant'; content: string };

// Explicit request context only. Never loads browser or other users' history.
export function geminiConversation(body: Record<string, unknown>) {
  const { messages, prompt, systemInstruction, max_tokens, temperature } = body;
  if (prompt !== undefined && (typeof prompt !== 'string' || prompt.length > 32000)) invalid('Prompt no válido.');
  if (systemInstruction !== undefined && (typeof systemInstruction !== 'string' || systemInstruction.length > 32000)) invalid('Instrucción de sistema no válida.');
  if (max_tokens !== undefined && (!Number.isInteger(max_tokens) || Number(max_tokens) < 1 || Number(max_tokens) > 4096)) invalid('Límite de salida no válido.');
  if (temperature !== undefined && (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2)) invalid('Temperatura no válida.');
  if (messages !== undefined && (!Array.isArray(messages) || messages.length > 64)) invalid('Historial no válido.');
  const history: Message[] = [];
  let characters = 0;
  for (const value of (messages || []) as unknown[]) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Mensaje no válido.');
    const message = value as Record<string, unknown>;
    if (typeof message.role !== 'string' || !['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string' ||
        message.content.length > 32000 || !message.content.trim()) invalid('Rol o contenido de mensaje no válido.');
    characters += (message.content as string).length;
    if (characters > 64000) invalid('El historial supera el límite permitido.');
    history.push({ role: message.role as Message['role'], content: message.content as string });
  }
  const system = history[0]?.role === 'system' ? history.shift()!.content : undefined;
  if (history.some(message => message.role === 'system')) invalid('La instrucción de sistema sólo puede aparecer al inicio.');
  if (system !== undefined && systemInstruction !== undefined && system !== systemInstruction)
    invalid('systemInstruction y el mensaje system se contradicen.');
  if (history.length) {
    if (history[0].role !== 'user' || history.at(-1)!.role !== 'user') invalid('La conversación debe empezar y terminar con un turno user.');
    if (prompt !== undefined && prompt !== history.at(-1)!.content) invalid('prompt y el último turno user se contradicen.');
  } else {
    if (typeof prompt !== 'string' || !prompt.trim()) invalid('Falta un turno user o prompt explícito.');
    history.push({ role: 'user', content: prompt as string });
  }
  return {
    contents: history.map(message => ({ role: message.role === 'assistant' ? 'model' as const : 'user' as const, parts: [{ text: message.content }] })),
    config: { maxOutputTokens: max_tokens === undefined ? 4096 : Number(max_tokens),
      ...((systemInstruction ?? system) !== undefined ? { systemInstruction: (systemInstruction ?? system) as string } : {}),
      ...(temperature !== undefined ? { temperature: temperature as number } : {}) },
  };
}
