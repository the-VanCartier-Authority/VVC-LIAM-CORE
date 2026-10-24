export type OutcomeStatus = 'generated' | 'executed' | 'simulated' | 'failed' | 'unavailable';
export interface ExecutionOutcome {
  status: OutcomeStatus;
  realExecution: false;
  source: string;
}

// There is no verified external action executor in this release. Neither model
// text nor a client-provided receipt can prove that an external effect occurred.
export function executionOutcome(status: OutcomeStatus, source: string): ExecutionOutcome {
  if (status === 'executed') throw new Error('VERIFIED_EXECUTOR_UNAVAILABLE');
  if (!['generated', 'simulated', 'failed', 'unavailable'].includes(status)) throw new Error('INVALID_OUTCOME_STATUS');
  return Object.freeze({ status, realExecution: false, source });
}

export function inferenceFailureText(): string {
  return 'No se pudo generar una respuesta. No se ha ejecutado ninguna acción.';
}
