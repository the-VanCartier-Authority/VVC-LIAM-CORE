import type { Request, Response, Router } from 'express';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { executionOutcome } from '../shared/executionOutcome.ts';
import type { ExecutionOutcome } from '../shared/executionOutcome.ts';
import type { BackendLimits } from './backendLimits.ts';
import { ResourceLimitError } from './backendLimits.ts';
import { VaosStore, QueueError, digest } from './vaosStore.ts';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

export type TaskPriority = 'P0_CRITICAL' | 'P1_HIGH' | 'P2_LOW';
export type TaskRoute = 'FAST_PATH' | 'ASYNC_PATH';
export type TaskStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UNAVAILABLE' | 'CANCELLED' | 'INTERRUPTED';

export interface VaosTask {
  taskId: string;
  readonly ownerUid: string;
  command: string;
  agentId: string;
  priority: TaskPriority;
  route: TaskRoute;
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  injectedSkills: string[];
  retryOf?: string;
  delivery?: 'not_attempted' | 'unknown' | 'response_received';
  model?: string;
  result?: {
    text: string;
    outcome: ExecutionOutcome;
    actionType?: string;
    tokensPerSec?: number | null;
    tokensGenerated?: number;
    tokensSource?: 'provider' | 'estimated' | 'unavailable';
    data?: Record<string, unknown>;
  };
  error?: string;
}

export interface TelemetryRecord {
  ownerUid: string | null;
  timestamp: number;
  taskId: string;
  command: string;
  priority: TaskPriority;
  route: TaskRoute;
  latencyMs: number;
  tokensPerSec: number | null;
  tokensSource: 'provider' | 'estimated' | 'unavailable';
  latencyScope: 'policy_routing' | 'processing_wall_time';
  success: boolean;
  agentId: string;
}

/**
 * VAOS POLICY ENGINE (Gobernanza previa a la ejecución)
 */
export class VaosPolicyEngine {
  public static evaluate(
    command: string,
    agentId?: string,
    forcePriority?: unknown,
    commandLimit = 5000
  ): {
    approved: boolean; reason?: string; code?: string;
    priority: TaskPriority; route: TaskRoute; category: string;
  } {
    const policy = this.classify(command, commandLimit);
    // Server classification is authoritative, including security rejection.
    // Client hints may increase scrutiny; they can never lower it.
    if (!policy.approved || forcePriority === undefined) return policy;
    const priorities: readonly TaskPriority[] = ['P0_CRITICAL', 'P1_HIGH', 'P2_LOW'];
    const suggested = priorities.find(priority => priority === forcePriority);
    if (!suggested) return { ...policy, approved: false, code: 'INVALID_PRIORITY',
      reason: 'Prioridad solicitada no válida.' };
    if (priorities.indexOf(suggested) > priorities.indexOf(policy.priority)) return {
      ...policy, approved: false, code: 'PRIORITY_DOWNGRADE',
      reason: 'La prioridad solicitada rebaja la clasificación del servidor.',
    };
    if (suggested === policy.priority) return policy;
    return { ...policy, priority: suggested, route: 'ASYNC_PATH', category: `CLIENT_ESCALATED_${policy.category}` };
  }

  private static classify(command: string, commandLimit: number): {
    approved: boolean;
    reason?: string;
    priority: TaskPriority;
    route: TaskRoute;
    category: string;
  } {
    const cmd = command.toLowerCase().trim();

    // 1. Sanitization / Safety Check
    if (cmd.includes('<script>') || cmd.includes('__proto__') || cmd.length > commandLimit) {
      return {
        approved: false,
        reason: 'Violación de directiva de seguridad: contenido sospechoso o exceso de carga.',
        priority: 'P0_CRITICAL',
        route: 'ASYNC_PATH',
        category: 'SECURITY_BLOCKED',
      };
    }

    // 2. High Risk / Critical Operations (P0_CRITICAL -> Async Path)
    const isCritical =
      cmd.includes('bóveda') ||
      cmd.includes('boveda') ||
      cmd.includes('e2ee') ||
      cmd.includes('clave') ||
      cmd.includes('cifrado') ||
      cmd.includes('osint') ||
      cmd.includes('reconocimiento') ||
      cmd.includes('vulnerabilidad') ||
      cmd.includes('seguridad crítica') ||
      cmd.includes('formatear') ||
      cmd.includes('restablecer');

    if (isCritical) {
      return {
        approved: true,
        priority: 'P0_CRITICAL',
        route: 'ASYNC_PATH',
        category: 'CRITICAL_SECURITY_OR_OSINT',
      };
    }

    // 3. Operational Tasks (P1_HIGH -> Async Path)
    const isHighPriority =
      cmd.includes('crear documento') ||
      cmd.includes('hoja de cálculo') ||
      cmd.includes('hoja de calculo') ||
      cmd.includes('exportar pdf') ||
      cmd.includes('sincronizar calendario') ||
      cmd.includes('enviar correo') ||
      cmd.includes('borrador') ||
      cmd.includes('notificación programada');

    if (isHighPriority) {
      return {
        approved: true,
        priority: 'P1_HIGH',
        route: 'ASYNC_PATH',
        category: 'OPERATIONAL_ASYNC',
      };
    }

    // 4. Fast Path (<200ms SLA - P2_LOW)
    return {
      approved: true,
      priority: 'P2_LOW',
      route: 'FAST_PATH',
      category: 'INFORMATIVE_FAST_PATH',
    };
  }
}

/**
 * VAOS TASK QUEUE & TELEMETRY REGISTRY
 * Private single-process durable text-generation queue. No external action executor.
 */
export class VaosOrchestrator {
  private tasks = new Map<string, VaosTask>();
  private telemetryRing: TelemetryRecord[] = [];
  private maxRingSize = 300;

  private limits?: BackendLimits;
  private store: VaosStore;
  private leases = new Map<string, () => void>();
  private active = new Map<string, AbortController>();
  private paused: boolean;
  private workers: number;
  private attemptTimeout: number;
  private closed = false;
  private storageFailed = false;
  private scheduled = false;
  private execute: (task: VaosTask, signal: AbortSignal) => Promise<{ text?: string; tokens?: number; unavailable?: boolean }>;
  constructor(limits?: BackendLimits, options: { databasePath?: string; paused?: boolean; workers?: number; attemptTimeoutMs?: number;
    execute?: (task: VaosTask, signal: AbortSignal) => Promise<{ text?: string; tokens?: number; unavailable?: boolean }> } = {}) {
    this.limits = limits;
    this.workers = options.workers ?? Number(process.env.VAOS_WORKER_CONCURRENCY || 2);
    this.attemptTimeout = options.attemptTimeoutMs ?? Number(process.env.VAOS_ATTEMPT_TIMEOUT_MS || 30000);
    if (!Number.isSafeInteger(this.workers) || this.workers < 1 || this.workers > 8 ||
      !Number.isSafeInteger(this.attemptTimeout) || this.attemptTimeout < 1 || this.attemptTimeout > 30000 ||
      (process.env.VAOS_QUEUE_PAUSED !== undefined && !['true', 'false', ''].includes(process.env.VAOS_QUEUE_PAUSED)))
      throw new Error('INVALID_QUEUE_CONFIG');
    this.paused = options.paused ?? process.env.VAOS_QUEUE_PAUSED === 'true';
    this.store = new VaosStore(options.databasePath || process.env.VAOS_DATABASE_PATH || resolve('.data/vaos.sqlite'));
    this.execute = options.execute || generateVaosText;
    this.store.prune();
    for (const task of this.store.all()) {
      if (task.status === 'PROCESSING') {
        task.status = 'INTERRUPTED'; task.delivery = 'unknown'; task.completedAt = Date.now();
        task.result = this.noExecution('unavailable', 'Proceso interrumpido; la generación anterior puede haber llegado al proveedor. No se repetirá automáticamente.', true);
        this.store.save(task);
      } else if (task.status === 'QUEUED' && task.createdAt < Date.now() - 86400000) {
        task.status = 'UNAVAILABLE'; task.completedAt = Date.now();
        task.result = this.noExecution('unavailable', 'Tarea caducada sin iniciar generación.', false); this.store.save(task);
      } else if (task.status === 'QUEUED') {
        const policy = VaosPolicyEngine.evaluate(task.command, task.agentId, task.priority);
        if (!policy.approved) {
          task.status = 'FAILED'; task.completedAt = Date.now();
          task.result = this.noExecution('failed', 'La política actual no autoriza recuperar esta solicitud.', false);
          this.store.save(task);
        }
      }
      this.tasks.set(task.taskId, task);
    }
    this.recordInitialHealthProbe();
    this.schedule();
  }
  private noExecution(status: 'failed' | 'unavailable', text: string, generationMayHaveOccurred: boolean): NonNullable<VaosTask['result']> {
    return { text, outcome: executionOutcome(status, 'vaos'), actionType: 'not_executed',
      tokensPerSec: null, tokensSource: 'unavailable', data: { realExecution: false, generationMayHaveOccurred } };
  }
  private available() { if (this.closed || this.storageFailed) throw new QueueError(503, 'QUEUE_UNAVAILABLE', 'La cola no está disponible.'); }
  private fault(): never {
    this.storageFailed = true;
    for (const controller of this.active.values()) controller.abort();
    console.warn('[VAOS] Private queue storage unavailable; generation paused.');
    throw new QueueError(503, 'QUEUE_UNAVAILABLE', 'No se pudo confirmar el estado durable de la tarea.');
  }
  private save(task: VaosTask) {
    try {
      this.store.save(task);
      if (!['QUEUED', 'PROCESSING'].includes(task.status)) this.pruneHistory();
    } catch { this.fault(); }
  }
  private pruneHistory() {
    this.store.prune();
    const retained = new Set(this.store.all().map(task => task.taskId));
    for (const id of this.tasks.keys()) if (!retained.has(id)) this.tasks.delete(id);
  }
  public setPaused(paused: boolean) { this.paused = paused; if (!paused) this.schedule(); }
  public health() { return this.closed || this.storageFailed ? 'UNAVAILABLE' : this.paused ? 'PAUSED' : 'OK'; }
  public close() {
    if (this.closed) return;
    this.closed = true;
    for (const controller of this.active.values()) controller.abort();
    for (const release of this.leases.values()) release();
    this.leases.clear(); this.store.close();
  }
  private schedule() {
    if (this.scheduled || this.closed || this.storageFailed || this.paused) return;
    this.scheduled = true;
    setImmediate(() => { this.scheduled = false; this.pump(); }).unref();
  }
  private queued() {
    const rank = { P0_CRITICAL: 0, P1_HIGH: 1, P2_LOW: 2 };
    return [...this.tasks.values()].filter(task => task.status === 'QUEUED')
      .sort((a, b) => rank[a.priority] - rank[b.priority] || a.createdAt - b.createdAt);
  }
  private pump() {
    if (this.closed || this.storageFailed || this.paused) return;
    for (const task of this.queued()) {
      if (!this.leases.has(task.taskId)) {
        try { this.leases.set(task.taskId, this.limits?.task(task.ownerUid) || (() => {})); }
        catch (error) { if (error instanceof ResourceLimitError) continue; throw error; }
      }
      if (this.active.size >= this.workers) continue;
      const controller = new AbortController(); this.active.set(task.taskId, controller);
      this.processAsyncTask(task, controller).catch(() => { /* fault() already pauses the queue */ });
    }
  }

  /**
   * Record genuine boot self-test telemetry measurements rather than artificial random data
   */
  private recordInitialHealthProbe() {
    const bootTime = Date.now();
    // Fast path self-test
    const t0 = process.hrtime.bigint();
    const policyResult = VaosPolicyEngine.evaluate('Estado de núcleos y telemetría');
    const t1 = process.hrtime.bigint();
    const probeLatencyMs = Number(t1 - t0) / 1000000;

    this.recordTelemetry({
      timestamp: bootTime,
      taskId: 'boot-probe-01',
      ownerUid: null,
      command: 'Autoverificación de Arranque VAOS // Fast Path SLA',
      priority: policyResult.priority,
      route: 'FAST_PATH',
      latencyMs: probeLatencyMs,
      latencyScope: 'policy_routing',
      tokensPerSec: null,
      tokensSource: 'unavailable',
      success: true,
      agentId: 'core-kernel',
    });
  }

  public recordTelemetry(record: TelemetryRecord): void {
    this.telemetryRing.push(record);
    if (this.telemetryRing.length > this.maxRingSize) {
      this.telemetryRing.shift();
    }
  }

  public getTelemetry(ownerUid: string) {
    const points = this.telemetryRing.filter(point => point.ownerUid === ownerUid);
    const fastPoints = points.filter((p) => p.route === 'FAST_PATH');
    const asyncPoints = points.filter((p) => p.route === 'ASYNC_PATH');

    const avgFastPathLatencyMs =
      fastPoints.length > 0
        ? Math.round(fastPoints.reduce((acc, p) => acc + p.latencyMs, 0) / fastPoints.length)
        : null;

    const avgAsyncDurationMs =
      asyncPoints.length > 0
        ? Math.round(asyncPoints.reduce((acc, p) => acc + p.latencyMs, 0) / asyncPoints.length)
        : null;

    const rates = points.filter(point => point.tokensSource === 'provider' && point.tokensPerSec !== null);
    const avgTokensPerSec = rates.length
      ? Number((rates.reduce((sum, point) => sum + point.tokensPerSec!, 0) / rates.length).toFixed(1)) : null;

    return {
      points,
      stats: {
        avgFastPathLatencyMs,
        avgAsyncDurationMs,
        avgTokensPerSec,
        tokenRateScope: 'processing_wall_time',
        totalDispatched: points.length,
        fastPathCount: fastPoints.length,
        asyncCount: asyncPoints.length,
        p0Count: points.filter((p) => p.priority === 'P0_CRITICAL').length,
        p1Count: points.filter((p) => p.priority === 'P1_HIGH').length,
        p2Count: points.filter((p) => p.priority === 'P2_LOW').length,
      },
    };
  }

  public enqueueTask(ownerUid: string, command: string, agentId: string, priority: TaskPriority,
    injectedSkills: string[] = [], options: { idempotencyKey?: string; retryOf?: string } = {}): VaosTask {
    this.available();
    if (!ownerUid) throw new Error('VERIFIED_OWNER_REQUIRED');
    const fingerprint = digest(JSON.stringify({ command, agentId, priority, injectedSkills, retryOf: options.retryOf || null }));
    let replay: VaosTask | undefined;
    try { replay = this.store.replay(ownerUid, options.idempotencyKey, fingerprint); }
    catch (error) { if (error instanceof QueueError) throw error; this.fault(); }
    if (replay) return replay;
    // Existing leases bound admitted work (queued + processing), not just HTTP lifetime.
    const outstanding = [...this.tasks.values()].filter(task => ['QUEUED', 'PROCESSING'].includes(task.status));
    if (outstanding.length >= 8 || outstanding.filter(task => task.ownerUid === ownerUid).length >= 2 ||
        outstanding.some(task => !this.leases.has(task.taskId))) throw new ResourceLimitError(429, 1);
    const release = this.limits?.task(ownerUid) || (() => {});
    const task: VaosTask = { taskId: `liam-task-${randomUUID()}`, ownerUid, command, agentId, priority,
      route: 'ASYNC_PATH', status: 'QUEUED', createdAt: Date.now(), injectedSkills: [...injectedSkills],
      delivery: 'not_attempted', model: 'gemini-2.5-flash', ...(options.retryOf ? { retryOf: options.retryOf } : {}) };
    if (Buffer.byteLength(JSON.stringify(task)) > 32000) { release(); throw new ResourceLimitError(400); }
    try { this.store.insert(task, options.idempotencyKey, fingerprint, this.limits?.dailyGenerationLimit() || 1000000); }
    catch (error) { release(); if (error instanceof ResourceLimitError || error instanceof QueueError) throw error; this.fault(); }
    this.tasks.set(task.taskId, task); this.leases.set(task.taskId, release);
    this.pruneHistory();
    this.schedule();
    return structuredClone(task);
  }
  private async processAsyncTask(task: VaosTask, controller: AbortController) {
    const started = process.hrtime.bigint();
    const timer = setTimeout(() => controller.abort(), this.attemptTimeout); timer.unref();
    try {
      task.status = 'PROCESSING'; task.startedAt = Date.now(); task.delivery = 'unknown';
      this.save(task); // Commit the uncertainty boundary BEFORE any provider request.
      const generated = await this.execute(structuredClone(task), controller.signal);
      if (this.closed || task.status !== 'PROCESSING') return;
      if (controller.signal.aborted) throw new Error('GENERATION_CANCELLED');
      task.completedAt = Date.now(); task.durationMs = Number(process.hrtime.bigint() - started) / 1000000;
      if (generated.unavailable) {
        task.status = 'UNAVAILABLE'; task.delivery = 'not_attempted';
        task.result = this.noExecution('unavailable', 'Proveedor no disponible. No se ha ejecutado ninguna acción.', false);
      } else {
        const text = generated.text?.trim();
        if (!text || Buffer.byteLength(text) > 64000) throw new Error('GENERATION_INVALID');
        const providerTokens = Number.isSafeInteger(generated.tokens) && generated.tokens! >= 0;
        const result = { text, outcome: executionOutcome('generated', 'gemini'), actionType: 'text_generation',
          tokensGenerated: providerTokens ? generated.tokens : Math.ceil(text.length / 4),
          tokensSource: providerTokens ? 'provider' as const : 'estimated' as const,
          tokensPerSec: providerTokens && task.durationMs > 0 ? generated.tokens! * 1000 / task.durationMs : null,
          data: { realExecution: false, requestedModel: task.model, modelSource: 'requested_only', generatedForAgent: task.agentId, skillsActive: task.injectedSkills } };
        if (Buffer.byteLength(JSON.stringify({ ...task, result })) > 128 * 1024) throw new Error('GENERATION_INVALID');
        task.result = result; task.status = 'COMPLETED'; task.delivery = 'response_received';
      }
      this.save(task); this.recordTaskTelemetry(task);
    } catch (error) {
      if (this.closed || this.storageFailed || task.status !== 'PROCESSING') return;
      task.status = 'FAILED'; task.completedAt = Date.now(); task.durationMs = Number(process.hrtime.bigint() - started) / 1000000;
      task.error = 'No se pudo confirmar una generación válida. No se ha ejecutado ninguna acción.';
      task.result = this.noExecution('failed', task.error, true); this.save(task); this.recordTaskTelemetry(task);
    } finally {
      clearTimeout(timer); this.active.delete(task.taskId);
      this.leases.get(task.taskId)?.(); this.leases.delete(task.taskId); this.schedule();
    }
  }
  private recordTaskTelemetry(task: VaosTask) {
    this.recordTelemetry({ ownerUid: task.ownerUid, timestamp: task.completedAt!, taskId: task.taskId,
      command: task.command, priority: task.priority, route: task.route, latencyMs: task.durationMs || 0,
      latencyScope: 'processing_wall_time', tokensPerSec: task.result?.tokensPerSec ?? null,
      tokensSource: task.result?.tokensSource || 'unavailable', success: task.status === 'COMPLETED', agentId: task.agentId });
  }
  public getTask(taskId: string, ownerUid: string): VaosTask | undefined {
    this.available(); const task = this.tasks.get(taskId);
    return task?.ownerUid === ownerUid ? structuredClone(task) : undefined;
  }
  public listTasks(ownerUid: string): VaosTask[] {
    this.available();
    return [...this.tasks.values()].filter(task => task.ownerUid === ownerUid).slice(-20).reverse().map(task => structuredClone(task));
  }
  public queuePosition(taskId: string) { return Math.max(0, this.queued().findIndex(task => task.taskId === taskId) + 1); }
  public cancelTask(taskId: string, ownerUid: string): VaosTask | undefined {
    this.available(); const task = this.tasks.get(taskId);
    if (!task || task.ownerUid !== ownerUid) return undefined;
    if (task.status === 'CANCELLED') return structuredClone(task);
    if (!['QUEUED', 'PROCESSING'].includes(task.status)) throw new QueueError(409, 'TASK_TERMINAL', 'La tarea ya está en un estado terminal.');
    const uncertain = task.status === 'PROCESSING';
    task.status = 'CANCELLED'; task.completedAt = Date.now();
    task.result = this.noExecution('unavailable', uncertain
      ? 'Cancelación local registrada. El proveedor puede haber recibido la petición; no se puede retirar una generación remota ya iniciada.'
      : 'Cancelada antes de iniciar la generación.', uncertain);
    this.save(task);
    if (uncertain) this.active.get(taskId)?.abort();
    else { this.leases.get(taskId)?.(); this.leases.delete(taskId); }
    this.schedule(); return structuredClone(task);
  }

}

async function generateVaosText(task: VaosTask, signal: AbortSignal) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return { unavailable: true };
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 30000, retryOptions: { attempts: 1 } } });
  let agentDirective = 'Eres un agente operativo autónomo del sistema VVC LIAM CORE.';
  if (task.agentId.includes('vladimir')) {
    agentDirective = 'Eres Vladimir, Director de Inteligencia y Reconocimiento Táctico (OSINT) de VVC LIAM CORE. Responde con precisión táctica, concisión y autoridad analítica.';
  } else if (task.agentId.includes('valentina')) {
    agentDirective = 'Eres Valentina, Especialista en Análisis Criptográfico, Ciberdefensa y Validación E2EE de VVC LIAM CORE. Tu foco es el rigor de seguridad y cifrado.';
  } else if (task.agentId.includes('victoria')) {
    agentDirective = 'Eres Victoria, Directora de Estrategia Operativa y Gestión Ejecutiva de VVC LIAM CORE. Proporciona síntesis accionables y directrices claras.';
  }

  const skillsNote = task.injectedSkills.length > 0
    ? `\nHabilidades activas requeridas: ${task.injectedSkills.join(', ')}.`
    : '';

  const fullPrompt = `${agentDirective}${skillsNote}\n\nSólo generas texto. No tienes herramientas para ejecutar acciones externas. No afirmes que has enviado, creado, borrado o completado acciones del usuario.\nSolicitud [${task.priority}]: "${task.command}".`;
  const response = await ai.models.generateContent({ model: task.model!, contents: fullPrompt,
    config: { maxOutputTokens: 4096, abortSignal: signal } });
  return { text: response.text, tokens: response.usageMetadata?.candidatesTokenCount };
}

/**
 * Creates VAOS Express Router
 */
export function createVaosRouter(limits?: BackendLimits): Router {
  const router = express.Router();
  const service = new VaosOrchestrator(limits);
  process.once('exit', () => service.close());

  // POST /api/vaos/dispatch
  router.post('/dispatch', (req: Request, res: Response) => {
    const startTime = process.hrtime.bigint();
    const { command, agentId = 'exclusive-vladimir', forcePriority, injectedSkills = [] } = req.body || {};

    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'Comando no especificado.' });
    }

    // 1. Evaluate with Policy Engine
    const policy = VaosPolicyEngine.evaluate(command, agentId, forcePriority);

    if (!policy.approved) {
      return res.status(policy.code === 'INVALID_PRIORITY' ? 400 : 403).json({
        route: policy.route,
        priority: policy.priority,
        policyApproved: false,
        policyReason: policy.reason,
        code: policy.code || 'POLICY_REJECTED',
        outcome: executionOutcome('failed', 'vaos-policy'),
      });
    }

    // 2. FAST PATH EXECUTION (<200ms target)
    if (policy.route === 'FAST_PATH') {
      const latencyMs = Number(process.hrtime.bigint() - startTime) / 1000000;
      const responseText = 'Simulación local de enrutamiento. No se ha ejecutado ninguna acción.';
      const tokensPerSec = null;

      const fastResult = {
        route: 'FAST_PATH' as TaskRoute,
        priority: policy.priority,
        policyApproved: true,
        immediateResponse: {
          text: responseText,
          outcome: executionOutcome('simulated', 'vaos-fast-path'),
          latencyMs,
          tokensPerSec,
          handledBy: agentId,
          data: {
            latencyTargetMs: 200,
            policyCategory: policy.category,
            realExecution: false,
          },
        },
      };

      service.recordTelemetry({
        ownerUid: req.auth!.uid,
        timestamp: Date.now(),
        taskId: `fast-${Date.now()}`,
        command,
        priority: policy.priority,
        route: 'FAST_PATH',
        latencyMs,
        latencyScope: 'policy_routing',
        tokensPerSec,
        tokensSource: 'unavailable',
        success: true,
        agentId,
      });

      return res.json(fastResult);
    }

    // 3. ASYNC PATH EXECUTION (P0_CRITICAL / P1_HIGH Queue)
    const task = service.enqueueTask(req.auth!.uid, command, agentId, policy.priority, injectedSkills, { idempotencyKey: idempotencyKey(req) });

    return res.json({
      route: 'ASYNC_PATH' as TaskRoute,
      priority: policy.priority,
      policyApproved: true,
      asyncTask: {
        taskId: task.taskId,
        status: task.status,
        queuePosition: service.queuePosition(task.taskId),
        durable: true,
        durabilityScope: 'local-filesystem-process-restart',
        pollUrl: `/api/vaos/task/${task.taskId}`,
      },
    });
  });

  // GET /api/vaos/task/:taskId
  router.get('/task/:taskId', (req: Request, res: Response) => {
    const { taskId } = req.params;
    const task = service.getTask(taskId, req.auth!.uid);
    if (!task) {
      return res.status(404).json({ error: `Tarea no encontrada: ${taskId}` });
    }
    return res.json(task);
  });

  router.delete('/task/:taskId', (req, res) => {
    const task = service.cancelTask(req.params.taskId, req.auth!.uid);
    return task ? res.json(task) : res.status(404).json({ error: 'Tarea no encontrada.' });
  });
  router.post('/task/:taskId/retry', (req, res) => {
    const previous = service.getTask(req.params.taskId, req.auth!.uid);
    if (!previous) return res.status(404).json({ error: 'Tarea no encontrada.' });
    if (!['FAILED', 'UNAVAILABLE', 'INTERRUPTED', 'CANCELLED'].includes(previous.status))
      throw new QueueError(409, 'TASK_NOT_RETRYABLE', 'Sólo se reintentan tareas terminales no completadas.');
    if (previous.delivery === 'unknown' && req.body?.acknowledgeUncertainDelivery !== true)
      throw new QueueError(409, 'UNCERTAIN_DELIVERY', 'La generación anterior puede haber ocurrido. Confirma explícitamente antes de pedir otra.');
    const key = idempotencyKey(req);
    if (!key) throw new QueueError(400, 'IDEMPOTENCY_REQUIRED', 'El reintento requiere Idempotency-Key.');
    const policy = VaosPolicyEngine.evaluate(previous.command, previous.agentId, previous.priority);
    if (!policy.approved) throw new QueueError(403, 'POLICY_REJECTED', 'La política actual no autoriza reintentar esta solicitud.');
    const task = service.enqueueTask(req.auth!.uid, previous.command, previous.agentId, policy.priority,
      previous.injectedSkills, { idempotencyKey: key, retryOf: previous.taskId });
    return res.json({ taskId: task.taskId, status: task.status, retryOf: task.retryOf, durable: true,
      durabilityScope: 'local-filesystem-process-restart', pollUrl: `/api/vaos/task/${task.taskId}` });
  });

  // GET /api/vaos/tasks
  router.get('/tasks', (req: Request, res: Response) => {
    return res.json(service.listTasks(req.auth!.uid));
  });

  // GET /api/vaos/telemetry
  router.get('/telemetry', (req: Request, res: Response) => {
    return res.json(service.getTelemetry(req.auth!.uid));
  });

  // GET /api/vaos/health
  router.get('/health', (_req: Request, res: Response) => {
    const status = service.health();
    return res.status(status === 'UNAVAILABLE' ? 503 : 200).json({ status, engine: 'VAOS-Text-Queue', time: Date.now() });
  });

  router.use((error: unknown, _req: Request, res: Response, next: (error: unknown) => void) => {
    if (error instanceof ResourceLimitError) return next(error);
    if (error instanceof QueueError) return res.status(error.status).json({ code: error.code, error: error.message,
      outcome: executionOutcome('failed', 'vaos') });
    console.warn('[VAOS] Queue operation failed.');
    return res.status(503).json({ code: 'QUEUE_UNAVAILABLE', error: 'La cola no está disponible.', outcome: executionOutcome('unavailable', 'vaos') });
  });
  return router;
}
function idempotencyKey(req: Request): string | undefined {
  const key = req.headers['idempotency-key'];
  if (key === undefined) return undefined;
  if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(key) ||
      req.rawHeaders.filter((_, index) => index % 2 === 0).filter(name => name.toLowerCase() === 'idempotency-key').length !== 1)
    throw new QueueError(400, 'INVALID_IDEMPOTENCY_KEY', 'Clave de idempotencia no válida.');
  return key;
}
