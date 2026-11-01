import { executionOutcome } from './executionOutcome.ts';

// G02 release restriction. Only a future reviewed code change may enable B05.
// No environment, URL, stored preference or UI override is accepted.
export const NOTIFICATIONS_ENABLED = false;
export const NOTIFICATION_POLICY_REVISION = 'g02-notifications-disabled-v1';
export const NOTIFICATIONS_DISABLED_MESSAGE =
  'Las notificaciones push y locales están deshabilitadas hasta la revisión y autorización de B05.';
export const notificationUnavailable = () => ({
  success: false as const,
  code: 'PUSH_DISABLED' as const,
  message: NOTIFICATIONS_DISABLED_MESSAGE,
  error: NOTIFICATIONS_DISABLED_MESSAGE,
  outcome: executionOutcome('unavailable', 'push'),
  realExecution: false as const,
});
