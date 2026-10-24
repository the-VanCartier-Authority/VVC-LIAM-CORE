import type { Request, Response, Router } from 'express';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { executionOutcome } from '../shared/executionOutcome.ts';
import type { ExecutionOutcome } from '../shared/executionOutcome.ts';
import type { BackendLimits } from './backendLimits.ts';
import { ResourceLimitError } from './backendLimits.ts';

export type TaskPriority = 'P0_CRITICAL' | 'P1_HIGH' | 'P2_LOW';
export type TaskRoute = 'FAST_PATH' | 'ASYNC_PATH';
export type TaskStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UNAVAILABLE';

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
    forcePriority?: TaskPriority
  ): {
    approved: boolean;
    reason?: string;
    priority: TaskPriority;
    route: TaskRoute;
    category: string;
  } {
    const cmd = command.toLowerCase().trim();

    // 1. Sanitization / Safety Check
    if (cmd.includes('<script>') || cmd.includes('__proto__') || cmd.length > 5000) {
      return {
        approved: false,
        reason: 'Violación de directiva de seguridad: contenido sospechoso o exceso de carga.',
        priority: 'P0_CRITICAL',
        route: 'ASYNC_PATH',
        category: 'SECURITY_BLOCKED',
      };
    }

    if (forcePriority) {
      return {
        approved: true,
        priority: forcePriority,
        route: forcePriority === 'P2_LOW' ? 'FAST_PATH' : 'ASYNC_PATH',
        category: 'USER_OVERRIDE',
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
 * In-memory text-generation queue. No external action executor is implemented.
 */
export class VaosOrchestrator {
  private tasks = new Map<string, VaosTask>();
  private telemetryRing: TelemetryRecord[] = [];
  private maxRingSize = 300;

  private limits?: BackendLimits;
  constructor(limits?: BackendLimits) {
    this.limits = limits;
    this.recordInitialHealthProbe();
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

  public enqueueTask(
    ownerUid: string,
    command: string,
    agentId: string,
    priority: TaskPriority,
    injectedSkills: string[] = []
  ): VaosTask {
    if (!ownerUid) throw new Error('VERIFIED_OWNER_REQUIRED');
    // Bounded in-memory history, not a durable queue. Never evict active work.
    const terminal = Array.from(this.tasks.values()).filter(task => !['QUEUED', 'PROCESSING'].includes(task.status));
    const owned = terminal.filter(task => task.ownerUid === ownerUid);
    while (owned.length >= 100) this.tasks.delete(owned.shift()!.taskId);
    while (this.tasks.size >= 1000 && terminal.length) this.tasks.delete(terminal.shift()!.taskId);
    if (this.tasks.size >= 1000) throw new ResourceLimitError(503);
    const release = this.limits?.task(ownerUid);
    const taskId = `liam-task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const task: VaosTask = {
      taskId,
      ownerUid,
      command,
      agentId,
      priority,
      route: 'ASYNC_PATH',
      status: 'QUEUED',
      createdAt: Date.now(),
      injectedSkills,
    };

    this.tasks.set(taskId, task);

    // Execute asynchronously via real background execution pipeline
    setImmediate(() => {
      this.processAsyncTask(taskId).then(() => release?.(), () => release?.());
    });

    return task;
  }

  /**
   * Real Execution Pipeline with Gemini GenAI Integration and Live Telemetry
   */
  private async processAsyncTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'PROCESSING';
    task.startedAt = Date.now();
    const monotonicStart = process.hrtime.bigint();

    const apiKey = process.env.GEMINI_API_KEY;
    let responseText = '';
    let tokenCount = 0;
    let tokensSource: 'provider' | 'estimated' = 'estimated';

    try {
      if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
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

        const candidateModels = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-2.5-pro'];
        let response: any = null;
        for (const m of candidateModels) {
          try {
            response = await ai.models.generateContent({
              model: m,
              contents: fullPrompt,
              config: { maxOutputTokens: 4096 },
            });
            if (response?.text) break;
          } catch (modelErr: any) {
            console.warn('[VAOS AI] Model unavailable, trying next candidate');
          }
        }

        responseText = response?.text?.trim() || '';
        if (!responseText) throw new Error('PROVIDER_GENERATION_FAILED');
        const reportedCount = response?.usageMetadata?.candidatesTokenCount;
        tokensSource = Number.isInteger(reportedCount) && reportedCount >= 0 ? 'provider' : 'estimated';
        tokenCount = tokensSource === 'provider' ? reportedCount : Math.ceil(responseText.length / 4);
      } else {
        task.status = 'UNAVAILABLE';
        task.completedAt = Date.now();
        task.durationMs = Number(process.hrtime.bigint() - monotonicStart) / 1000000;
        task.result = { text: 'Proveedor no disponible. No se ha ejecutado ninguna acción.',
          outcome: executionOutcome('unavailable', 'vaos'), actionType: 'not_executed',
          data: { realExecution: false } };
        this.recordTelemetry({ timestamp: task.completedAt, taskId: task.taskId, ownerUid: task.ownerUid,
          command: task.command, priority: task.priority, route: task.route,
          latencyMs: task.durationMs, latencyScope: 'processing_wall_time', tokensPerSec: null,
          tokensSource: 'unavailable', success: false, agentId: task.agentId });
        return;
      }

      task.status = 'COMPLETED';
      task.completedAt = Date.now();
      task.durationMs = Number(process.hrtime.bigint() - monotonicStart) / 1000000;

      const elapsedSec = task.durationMs / 1000;
      const realTokensPerSec = tokensSource === 'provider' && elapsedSec > 0 ? Number((tokenCount / elapsedSec).toFixed(1)) : null;

      task.result = {
        text: responseText,
        outcome: executionOutcome('generated', 'gemini'),
        actionType: 'text_generation',
        tokensGenerated: tokenCount,
        tokensSource,
        tokensPerSec: realTokensPerSec,
        data: {
          priority: task.priority,
          generatedForAgent: task.agentId,
          skillsActive: task.injectedSkills,
          realExecution: false,
        },
      };

      // Record to telemetry ring with real measured values
      this.recordTelemetry({
        ownerUid: task.ownerUid,
        timestamp: task.completedAt,
        taskId: task.taskId,
        command: task.command,
        priority: task.priority,
        route: 'ASYNC_PATH',
        latencyMs: task.durationMs,
        latencyScope: 'processing_wall_time',
        tokensPerSec: realTokensPerSec,
        tokensSource,
        success: true,
        agentId: task.agentId,
      });
    } catch (err: any) {
      task.status = 'FAILED';
      task.completedAt = Date.now();
      task.durationMs = Number(process.hrtime.bigint() - monotonicStart) / 1000000;
      task.error = 'No se pudo generar una respuesta. No se ha ejecutado ninguna acción.';
      task.result = { text: task.error, outcome: executionOutcome('failed', 'gemini'),
        actionType: 'not_executed', data: { realExecution: false } };

      this.recordTelemetry({
        ownerUid: task.ownerUid,
        timestamp: task.completedAt,
        taskId: task.taskId,
        command: task.command,
        priority: task.priority,
        route: 'ASYNC_PATH',
        latencyMs: task.durationMs,
        latencyScope: 'processing_wall_time',
        tokensPerSec: null,
        tokensSource: 'unavailable',
        success: false,
        agentId: task.agentId,
      });
    }
  }

  public getTask(taskId: string, ownerUid: string): VaosTask | undefined {
    const task = this.tasks.get(taskId);
    return task?.ownerUid === ownerUid ? task : undefined;
  }

  public listTasks(ownerUid: string): VaosTask[] {
    return Array.from(this.tasks.values()).filter(task => task.ownerUid === ownerUid).slice(-20).reverse();
  }
}

export const vaosService = new VaosOrchestrator();

/**
 * Creates VAOS Express Router
 */
export function createVaosRouter(limits?: BackendLimits): Router {
  const router = express.Router();
  const service = limits ? new VaosOrchestrator(limits) : vaosService;

  // POST /api/vaos/dispatch
  router.post('/dispatch', (req: Request, res: Response) => {
    const startTime = process.hrtime.bigint();
    const { command, agentId = 'exclusive-vladimir', forcePriority, injectedSkills = [] } = req.body;

    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'Comando no especificado.' });
    }

    // 1. Evaluate with Policy Engine
    const policy = VaosPolicyEngine.evaluate(command, agentId, forcePriority);

    if (!policy.approved) {
      return res.status(403).json({
        route: 'FAST_PATH',
        priority: policy.priority,
        policyApproved: false,
        policyReason: policy.reason,
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
    const task = service.enqueueTask(req.auth!.uid, command, agentId, policy.priority, injectedSkills);

    return res.json({
      route: 'ASYNC_PATH' as TaskRoute,
      priority: policy.priority,
      policyApproved: true,
      asyncTask: {
        taskId: task.taskId,
        status: task.status,
        queuePosition: 1,
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
    return res.json({ status: 'OK', engine: 'VAOS-Policy-Core-Real', time: Date.now() });
  });

  return router;
}
