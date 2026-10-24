import type { Request, RequestHandler, Response } from 'express';
export class RequestAbortedError extends Error {
  constructor() { super('La solicitud fue cancelada.'); }
}
declare global { namespace Express { interface Request { inferenceSignal?: AbortSignal } } }
export function assertNotAborted(signal?: AbortSignal) { if (signal?.aborted) throw new RequestAbortedError(); }
export function assertChatActive(req: Request, res: Response) {
  if (req.aborted || res.destroyed) throw new RequestAbortedError();
  assertNotAborted(req.inferenceSignal);
}
export function withCancellation<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(new RequestAbortedError()); };
    signal.addEventListener('abort', abort, { once: true });
    // DNS can settle after cancellation. Keep handlers without starting a request
    // or producing an unhandled rejection from that late completion.
    operation.then(value => { signal.removeEventListener('abort', abort); signal.aborted ? reject(new RequestAbortedError()) : resolve(value); },
      error => { signal.removeEventListener('abort', abort); reject(signal.aborted ? new RequestAbortedError() : error); });
    if (signal.aborted) abort();
  });
}
export const chatCancellation: RequestHandler = (req, res, next) => {
  const controller = new AbortController();
  Object.defineProperty(req, 'inferenceSignal', { value: controller.signal, writable: false, configurable: false });
  const abort = () => controller.abort();
  const close = () => { if (!res.writableEnded) abort(); cleanup(); };
  const cleanup = () => { req.off('aborted', abort); res.off('close', close); res.off('finish', cleanup); };
  req.once('aborted', abort); res.once('close', close); res.once('finish', cleanup);
  if (req.aborted || res.destroyed) { abort(); cleanup(); }
  next();
};
