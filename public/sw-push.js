// Imported by both public/sw.js and the generated Workbox worker.
// No environment, message or stored preference can enable notifications.
const VVC_NOTIFICATION_POLICY_REVISION = 'g02-notifications-disabled-v1';
self.addEventListener('push', (event) => {
  // Do not parse payloads, schedule work or display a notification.
  event.stopImmediatePropagation();
});
self.addEventListener('notificationclick', (event) => {
  // Legacy notification clicks must not navigate/open windows or execute tasks.
  event.stopImmediatePropagation();
  event.notification.close();
});
self.addEventListener('message', (event) => {
  const type = event.data?.type;
  if (type === 'GET_NOTIFICATION_POLICY') {
    event.ports?.[0]?.postMessage({ type: 'NOTIFICATION_POLICY', enabled: false,
      revision: VVC_NOTIFICATION_POLICY_REVISION });
  } else if (type === 'SHOW_BACKGROUND_NOTIFICATION' || type === 'SCHEDULE_BACKGROUND_NOTIFICATION') {
    event.stopImmediatePropagation();
    event.ports?.[0]?.postMessage({ success: false, code: 'PUSH_DISABLED', realExecution: false,
      outcome: { status: 'unavailable', source: 'push', realExecution: false } });
  }
});
