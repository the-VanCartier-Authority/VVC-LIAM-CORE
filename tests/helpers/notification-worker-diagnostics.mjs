// Passive fixture diagnostics only; no registration retries or product state changes.
export async function installWorkerDiagnostics(context) {
  await context.addInitScript(() => {
    if (!('serviceWorker' in navigator)) return;
    const events = window.__workerTrace = [], ids = new WeakMap(), watched = new WeakSet();
    let serial = 0, channelSerial = 0, currentRegistration = null;
    const note = (event, data = {}) => events.push({ atMs: Math.round(performance.now()), event, ...data });
    const identity = worker => {
      if (!worker) return null;
      if (!ids.has(worker)) ids.set(worker, ++serial);
      return { id: ids.get(worker), url: worker.scriptURL, state: worker.state };
    };
    const snapshot = () => ({ installing: identity(currentRegistration?.installing), waiting: identity(currentRegistration?.waiting),
      active: identity(currentRegistration?.active), controller: identity(navigator.serviceWorker.controller),
      confirmed: window.fixture?.lifecycle.isDisabledWorkerConfirmed() ?? null });
    const watchWorker = worker => {
      if (!worker || watched.has(worker)) return;
      watched.add(worker);
      worker.addEventListener('statechange', () => note('statechange', { worker: identity(worker), ...snapshot() }));
    };
    const watchRegistration = registration => {
      currentRegistration = registration;
      if (!watched.has(registration)) {
        watched.add(registration);
        registration.addEventListener('updatefound', () => {
          watchWorker(registration.installing); note('updatefound', snapshot());
        });
      }
      [registration.installing, registration.waiting, registration.active].forEach(watchWorker);
      note('registration-observed', snapshot());
    };
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      watchWorker(navigator.serviceWorker.controller); note('controllerchange', snapshot());
    });
    const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = (...args) => {
      note('register-call'); const result = originalRegister(...args);
      result.then(reg => { watchRegistration(reg); note('register-resolved', snapshot()); }, error => note('register-error', { error: error.message }));
      return result;
    };
    const originalUpdate = ServiceWorkerRegistration.prototype.update;
    ServiceWorkerRegistration.prototype.update = function(...args) {
      note('update-call', snapshot()); const result = originalUpdate.apply(this, args);
      result.then(() => note('update-resolved', snapshot()), error => note('update-error', { error: error.message, ...snapshot() }));
      return result;
    };
    // Observe the real transferred ports. Do not start ports or alter callbacks.
    const NativeChannel = window.MessageChannel, channels = new WeakMap();
    window.MessageChannel = class extends NativeChannel {
      constructor() {
        super(); const record = { id: ++channelSerial, started: null, target: null, closed: false };
        channels.set(this.port1, record); channels.set(this.port2, record);
        this.port1.addEventListener('message', event => {
          if (event.data?.type === 'NOTIFICATION_POLICY') note('policy-ack', { channel: record.id, target: record.target,
            elapsedMs: Math.round(performance.now() - record.started), revision: event.data.revision, enabled: event.data.enabled });
        });
      }
    };
    const originalPost = ServiceWorker.prototype.postMessage;
    ServiceWorker.prototype.postMessage = function(data, transfer) {
      if (data?.type === 'GET_NOTIFICATION_POLICY') {
        const record = channels.get(transfer?.[0]);
        if (record) { record.started = performance.now(); record.target = identity(this); }
        note('policy-query', { channel: record?.id ?? null, target: identity(this) });
      }
      return originalPost.call(this, data, transfer);
    };
    const originalClose = MessagePort.prototype.close;
    MessagePort.prototype.close = function() {
      const record = channels.get(this);
      if (record?.started !== null && record?.started !== undefined && !record.closed) {
        record.closed = true; note('policy-channel-closed', { channel: record.id, elapsedMs: Math.round(performance.now() - record.started) });
      }
      return originalClose.call(this);
    };
    window.__workerSnapshot = snapshot;
    window.__observeWorkerRegistration = watchRegistration;
    window.__probeWorkerPolicy = async () => {
      const controller = navigator.serviceWorker.controller;
      if (!controller) return { status: 'no-controller' };
      return new Promise(resolve => {
        const channel = new MessageChannel();
        const finish = result => { clearTimeout(deadline); channel.port1.close(); channel.port2.close(); resolve(result); };
        const deadline = setTimeout(() => finish({ status: 'timeout', target: identity(controller) }), 1500);
        channel.port1.onmessage = event => finish({ status: 'reply', type: event.data?.type,
          revision: event.data?.revision, enabled: event.data?.enabled, target: identity(controller) });
        controller.postMessage({ type: 'GET_NOTIFICATION_POLICY' }, [channel.port2]);
      });
    };
  });
}

export async function workerCheckpoint(page, label, probe = false) {
  const record = await page.evaluate(async ({ label, probe }) => {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (registration) window.__observeWorkerRegistration?.(registration);
    const policyProbe = probe ? await window.__probeWorkerPolicy?.() : undefined;
    return { checkpoint: label, state: window.__workerSnapshot?.(), events: window.__workerTrace?.splice(0), policyProbe,
      cacheNames: await caches.keys(), storage: {
        push: localStorage.getItem('vvc_liam_push_active'), unrelated: localStorage.getItem('unrelated-user-data'),
      } };
  }, { label, probe });
  console.log(JSON.stringify(record));
  return record;
}
