const OWNER_KEY = 'vvc_liam_push_owner_uid';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Registration = Pick<ServiceWorkerRegistration, 'pushManager' | 'getNotifications'>;

// A browser subscription is a device credential. Reusing it across account
// changes would keep the old account's audience on the shared device.
export function createPushSessionGuard(getUid: () => string | null, storage: StorageLike,
  getRegistration: () => Promise<Registration | undefined>) {
  let pending: Promise<unknown> = Promise.resolve();
  const serial = <T>(action: () => Promise<T>): Promise<T> => {
    const result = pending.then(action, action); pending = result.catch(() => {}); return result;
  };
  const revoke = async () => {
    storage.removeItem(OWNER_KEY);
    storage.removeItem('vvc_liam_push_active');
    const reg = await getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (sub && !(await sub.unsubscribe())) throw new Error('PUSH_DEVICE_REVOKE_FAILED');
    for (const notification of await reg.getNotifications()) notification.close();
  };
  const reset = async () => {
    const uid = getUid();
    if (!uid || storage.getItem(OWNER_KEY) !== uid) await revoke();
  };
  return {
    reset: () => serial(reset),
    revoke: () => serial(revoke),
    withAccount: <T>(subscribe: (uid: string) => Promise<T>) => serial(async () => {
      const uid = getUid();
      if (!uid) throw new Error('AUTH_REQUIRED');
      await reset();
      if (getUid() !== uid) { await revoke(); throw new Error('PUSH_ACCOUNT_CHANGED'); }
      let result: T;
      try { result = await subscribe(uid); }
      catch (error) { await revoke(); throw error; }
      if (getUid() !== uid) { await revoke(); throw new Error('PUSH_ACCOUNT_CHANGED'); }
      try { storage.setItem(OWNER_KEY, uid); }
      catch (error) { await revoke(); throw error; }
      return result;
    }),
  };
}
