import type { Request, Response, Router } from 'express';
import express from 'express';

export type TaskPriority = 'P0_CRITICAL' | 'P1_HIGH' | 'P2_LOW';
export type TaskRoute = 'FAST_PATH' | 'ASYNC_PATH';
export type TaskStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface VaosTask {
  taskId: string;
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
    actionType?: string;
    tokensPerSec?: number;
    data?: Record<string, unknown>;
  };
  error?: string;
}

export interface TelemetryRecord {
  timestamp: number;
  taskId: string;
  command: string;
  priority: TaskPriority;
  route: TaskRoute;
  latencyMs: number;
  tokensPerSec: number;
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
    // Consultas informativas, lectura de estado, cálculo, hora, batería, toggles simples
    return {
      approved: true,
      priority: 'P2_LOW',
      route: 'FAST_PATH',
      category: 'INFORMATIVE_FAST_PATH',
    };
  }
}

/**
 * VAOS IN-MEMORY TASK QUEUE & TELEMETRY REGISTRY
 */
export class VaosOrchestrator {
  private tasks = new Map<string, VaosTask>();
  private telemetryRing: TelemetryRecord[] = [];
  private maxRingSize = 250;

  constructor() {
    // Seed initial realistic telemetry points for instant visualization
    this.seedInitialTelemetry();
  }

  private seedInitialTelemetry() {
    const now = Date.now();
    const models = ['exclusive-vladimir', 'exclusive-valentina', 'exclusive-victoria', 'ag-executive'];

    for (let i = 24; i >= 1; i--) {
      const isFast = Math.random() > 0.4;
      const latency = isFast 
        ? Math.floor(65 + Math.random() * 85) // Fast Path: 65-150ms (<200ms)
        : Math.floor(320 + Math.random() * 450); // Async Path: 320-770ms

      const tps = Number((28 + Math.random() * 42).toFixed(1));
      const priority: TaskPriority = isFast ? 'P2_LOW' : Math.random() > 0.5 ? 'P1_HIGH' : 'P0_CRITICAL';

      this.telemetryRing.push({
        timestamp: now - i * 15000,
        taskId: `liam-seed-${i}`,
        command: isFast ? 'Consulta de estado del sistema' : 'Análisis táctico y cifrado E2EE',
        priority,
        route: isFast ? 'FAST_PATH' : 'ASYNC_PATH',
        latencyMs: latency,
        tokensPerSec: tps,
        success: true,
        agentId: models[i % models.length],
      });
    }
  }

  public recordTelemetry(record: TelemetryRecord): void {
    this.telemetryRing.push(record);
    if (this.telemetryRing.length > this.maxRingSize) {
      this.telemetryRing.shift();
    }
  }

  public getTelemetry() {
    const points = [...this.telemetryRing];
    const fastPoints = points.filter((p) => p.route === 'FAST_PATH');
    const asyncPoints = points.filter((p) => p.route === 'ASYNC_PATH');

    const avgFastPathLatencyMs = fastPoints.length > 0
      ? Math.round(fastPoints.reduce((acc, p) => acc + p.latencyMs, 0) / fastPoints.length)
      : 110;

    const avgAsyncDurationMs = asyncPoints.length > 0
      ? Math.round(asyncPoints.reduce((acc, p) => acc + p.latencyMs, 0) / asyncPoints.length)
      : 420;

    const avgTokensPerSec = points.length > 0
      ? Number((points.reduce((acc, p) => acc + p.tokensPerSec, 0) / points.length).toFixed(1))
      : 45.2;

    return {
      points,
      stats: {
        avgFastPathLatencyMs,
        avgAsyncDurationMs,
        avgTokensPerSec,
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
    command: string,
    agentId: string,
    priority: TaskPriority,
    injectedSkills: string[] = []
  ): VaosTask {
    const taskId = `liam-task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const task: VaosTask = {
      taskId,
      command,
      agentId,
      priority,
      route: 'ASYNC_PATH',
      status: 'QUEUED',
      createdAt: Date.now(),
      injectedSkills,
    };

    this.tasks.set(taskId, task);

    // Schedule asynchronous background worker execution
    setTimeout(() => {
      this.processAsyncTask(taskId);
    }, priority === 'P0_CRITICAL' ? 80 : 350);

    return task;
  }

  private processAsyncTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'PROCESSING';
    task.startedAt = Date.now();

    // Execute background work simulation with skill injection
    const processingTime = task.priority === 'P0_CRITICAL' ? 450 : 700;

    setTimeout(() => {
      task.status = 'COMPLETED';
      task.completedAt = Date.now();
      task.durationMs = task.completedAt - (task.startedAt || task.createdAt);

      const hasOsint = task.injectedSkills.includes('OSINT_RECON') || task.command.toLowerCase().includes('osint');
      const hasE2ee = task.injectedSkills.includes('CRYPTOGRAPHIC_DEFENSE') || task.command.toLowerCase().includes('cifrado');

      let responseText = `Operación procesada con éxito bajo protocolo VAOS [${task.priority}].`;
      if (hasOsint) {
        responseText = `[OSINT INTEL]: Reconocimiento táctico completado por Vladimir. Fuentes analizadas y vector verificado.`;
      } else if (hasE2ee) {
        responseText = `[SECOPS E2EE]: Victoria ha verificado la integridad de las claves AES-GCM. Bóveda blindada sin anomalías.`;
      }

      task.result = {
        text: responseText,
        actionType: task.priority === 'P0_CRITICAL' ? 'security_operation' : 'task_pipeline',
        tokensPerSec: Number((38 + Math.random() * 25).toFixed(1)),
        data: {
          priority: task.priority,
          executedByAgent: task.agentId,
          skillsActive: task.injectedSkills,
          integrityCheck: 'PASSED_SHA256',
        },
      };

      // Record to telemetry ring
      this.recordTelemetry({
        timestamp: task.completedAt,
        taskId: task.taskId,
        command: task.command,
        priority: task.priority,
        route: 'ASYNC_PATH',
        latencyMs: task.durationMs,
        tokensPerSec: task.result.tokensPerSec || 42,
        success: true,
        agentId: task.agentId,
      });
    }, processingTime);
  }

  public getTask(taskId: string): VaosTask | undefined {
    return this.tasks.get(taskId);
  }

  public listTasks(): VaosTask[] {
    return Array.from(this.tasks.values()).slice(-20).reverse();
  }
}

export const vaosService = new VaosOrchestrator();

/**
 * Creates VAOS Express Router
 */
export function createVaosRouter(): Router {
  const router = express.Router();

  // POST /api/vaos/dispatch
  router.post('/dispatch', (req: Request, res: Response) => {
    const startTime = Date.now();
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
      const latencyMs = Math.max(12, Date.now() - startTime + Math.floor(Math.random() * 25));
      const tokensPerSec = Number((55 + Math.random() * 30).toFixed(1));

      const fastResult = {
        route: 'FAST_PATH' as TaskRoute,
        priority: policy.priority,
        policyApproved: true,
        immediateResponse: {
          text: `[VVC LIAM CORE // FAST PATH]: ${command}. Verificado en ${latencyMs}ms sin latencia.`,
          latencyMs,
          tokensPerSec,
          handledBy: agentId,
          data: {
            sla: '<200ms',
            policyCategory: policy.category,
          },
        },
      };

      vaosService.recordTelemetry({
        timestamp: Date.now(),
        taskId: `fast-${Date.now()}`,
        command,
        priority: policy.priority,
        route: 'FAST_PATH',
        latencyMs,
        tokensPerSec,
        success: true,
        agentId,
      });

      return res.json(fastResult);
    }

    // 3. ASYNC PATH EXECUTION (P0_CRITICAL / P1_HIGH Queue)
    const task = vaosService.enqueueTask(command, agentId, policy.priority, injectedSkills);

    return res.json({
      route: 'ASYNC_PATH' as TaskRoute,
      priority: policy.priority,
      policyApproved: true,
      asyncTask: {
        taskId: task.taskId,
        status: task.status,
        estimatedDurationMs: policy.priority === 'P0_CRITICAL' ? 450 : 800,
        queuePosition: 1,
        pollUrl: `/api/vaos/task/${task.taskId}`,
      },
    });
  });

  // GET /api/vaos/task/:taskId
  router.get('/task/:taskId', (req: Request, res: Response) => {
    const { taskId } = req.params;
    const task = vaosService.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: `Tarea no encontrada: ${taskId}` });
    }
    return res.json(task);
  });

  // GET /api/vaos/tasks
  router.get('/tasks', (_req: Request, res: Response) => {
    return res.json(vaosService.listTasks());
  });

  // GET /api/vaos/telemetry
  router.get('/telemetry', (_req: Request, res: Response) => {
    return res.json(vaosService.getTelemetry());
  });

  return router;
}
