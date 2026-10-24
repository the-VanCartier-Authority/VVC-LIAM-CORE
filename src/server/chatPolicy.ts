import type { RequestHandler } from 'express';
import { VaosPolicyEngine } from './vaosOrchestrator.ts';
import { executionOutcome } from '../shared/executionOutcome.ts';

// One authoritative decision for every cloud chat request. This gate has no
// inference/job side effects; explicit VAOS jobs retain their separate API.
export const chatPolicy: RequestHandler = (req, res, next) => {
  const body = req.body || {};
  const last = Array.isArray(body.messages) ? body.messages.at(-1)?.content : undefined;
  const gemini = req.path.replace(/\/+$/, '').toLowerCase() === '/gemini';
  const command = (gemini ? body.prompt || last : last) || 'Hola';
  // Chat retains B02's 32k per-message bound; VAOS command API stays at 5k.
  const decision = VaosPolicyEngine.evaluate(command, body.agentId, body.forcePriority, 32000);
  res.setHeader('X-VVC-Policy-Approved', String(decision.approved));
  res.setHeader('X-VVC-Policy-Priority', decision.priority);
  if (!decision.approved) return res.status(decision.code === 'INVALID_PRIORITY' ? 400 : 403).json({
    code: decision.code || 'POLICY_REJECTED', policyApproved: false, policyReason: decision.reason,
    priority: decision.priority, route: decision.route,
    outcome: executionOutcome('failed', 'vaos-policy'), realExecution: false,
  });
  return next();
};
