import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, lstatSync, openSync, closeSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import type { VaosTask } from './vaosOrchestrator.ts';
import { ResourceLimitError } from './backendLimits.ts';

export class QueueError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const TERMINAL = "status NOT IN ('QUEUED','PROCESSING')";
const DAY = 86400000;
export class VaosStore {
  private db: DatabaseSync;
  private closed = false;
  constructor(filename: string) {
    const path = resolve(filename), directory = dirname(path);
    if (!filename || filename === ':memory:') throw new Error('QUEUE_PRIVATE_STORAGE_REQUIRED');
    if (['dist', 'public', 'build'].map(root => resolve(root)).some(root => path === root || path.startsWith(root + sep)))
      throw new Error('QUEUE_WEB_ROOT_FORBIDDEN');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const dir = lstatSync(directory);
    if (!dir.isDirectory() || dir.isSymbolicLink() || (dir.mode & 0o077) || dir.uid !== process.getuid?.())
      throw new Error('QUEUE_PRIVATE_DIRECTORY_REQUIRED');
    try { const descriptor = openSync(path, 'wx', 0o600); closeSync(descriptor); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new Error('QUEUE_STORAGE_UNAVAILABLE'); }
    const file = lstatSync(path);
    if (!file.isFile() || file.isSymbolicLink() || file.nlink !== 1 || (file.mode & 0o077) || file.uid !== process.getuid?.())
      throw new Error('QUEUE_PRIVATE_FILE_REQUIRED');
    this.db = new DatabaseSync(path);
    try {
      // Retain SQLite's OS lock across committed transactions. A second process
      // cannot run this single-worker-domain queue on the same database.
      this.db.exec('PRAGMA busy_timeout=100; PRAGMA locking_mode=EXCLUSIVE; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA max_page_count=65536;');
      const version = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
      if (![0, 1].includes(version.user_version)) throw new Error('QUEUE_SCHEMA_UNSUPPORTED');
      if (version.user_version === 0 && Number(this.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get()?.n))
        throw new Error('QUEUE_FOREIGN_DATABASE');
      this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS tasks(task_id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, status TEXT NOT NULL,
          priority TEXT NOT NULL, created_at INTEGER NOT NULL, snapshot TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS task_owner ON tasks(owner_uid, created_at);
        CREATE TABLE IF NOT EXISTS receipts(owner_uid TEXT NOT NULL, idem_hash TEXT NOT NULL, request_hash TEXT NOT NULL,
          task_id TEXT NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(owner_uid, idem_hash));
        CREATE TABLE IF NOT EXISTS quota(owner_uid TEXT NOT NULL, day INTEGER NOT NULL, tokens INTEGER NOT NULL, PRIMARY KEY(owner_uid, day));
        PRAGMA user_version=1; COMMIT;`);
      if (Object.values(this.db.prepare('PRAGMA quick_check').get() || {})[0] !== 'ok') throw new Error('QUEUE_INTEGRITY_FAILED');
    } catch { this.db.close(); throw new Error('QUEUE_STORAGE_UNAVAILABLE'); }
  }
  all(): VaosTask[] {
    return this.db.prepare('SELECT * FROM tasks ORDER BY created_at, rowid').all().map(row => {
      const task = JSON.parse(row.snapshot as string) as VaosTask;
      if (task.taskId !== row.task_id || task.ownerUid !== row.owner_uid || task.status !== row.status || task.priority !== row.priority ||
          task.createdAt !== row.created_at || typeof task.command !== 'string' || task.command.length > 5000 ||
          typeof task.agentId !== 'string' || !Array.isArray(task.injectedSkills) || task.injectedSkills.length > 32 ||
          !['P0_CRITICAL', 'P1_HIGH', 'P2_LOW'].includes(task.priority) ||
          !['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNAVAILABLE', 'CANCELLED', 'INTERRUPTED'].includes(task.status) ||
          Boolean(task.result?.outcome.realExecution)) throw new Error('QUEUE_SNAPSHOT_INVALID');
      return task;
    });
  }
  replay(uid: string, key: string | undefined, fingerprint: string, now = Date.now()): VaosTask | undefined {
    if (!key) return undefined;
    const row = this.db.prepare('SELECT request_hash,task_id FROM receipts WHERE owner_uid=? AND idem_hash=? AND expires_at>?')
      .get(uid, digest(key), now);
    if (!row) return undefined;
    if (row.request_hash !== fingerprint) throw new QueueError(409, 'IDEMPOTENCY_CONFLICT', 'La clave de idempotencia ya corresponde a otra petición.');
    const task = this.db.prepare('SELECT snapshot FROM tasks WHERE task_id=? AND owner_uid=?').get(row.task_id as string, uid);
    if (!task) throw new QueueError(410, 'RESULT_EXPIRED', 'El resultado fue retirado; no se repetirá la tarea con esta clave.');
    return JSON.parse(task.snapshot as string);
  }
  insert(task: VaosTask, key: string | undefined, fingerprint: string, dailyLimit: number, now = Date.now()) {
    const snapshot = JSON.stringify(task), day = Math.floor(now / DAY);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM receipts WHERE expires_at<=?').run(now);
      this.db.prepare('DELETE FROM quota WHERE day<?').run(day);
      const amount = Number(this.db.prepare('SELECT tokens FROM quota WHERE owner_uid=? AND day=?').get(task.ownerUid, day)?.tokens || 0);
      if (amount + 12288 > dailyLimit) throw new ResourceLimitError(429, Math.max(1, Math.ceil(((day + 1) * DAY - now) / 1000)));
      if (key && Number(this.db.prepare('SELECT COUNT(*) AS n FROM receipts').get()?.n) >= 10000) throw new ResourceLimitError(503);
      if (key && Number(this.db.prepare('SELECT COUNT(*) AS n FROM receipts WHERE owner_uid=?').get(task.ownerUid)?.n) >= 1000) throw new ResourceLimitError(429);
      if (Number(this.db.prepare('SELECT COUNT(DISTINCT owner_uid) AS n FROM quota').get()?.n) >= 10000 && !amount) throw new ResourceLimitError(503);
      this.db.prepare('INSERT INTO quota(owner_uid,day,tokens) VALUES(?,?,?) ON CONFLICT(owner_uid,day) DO UPDATE SET tokens=excluded.tokens')
        .run(task.ownerUid, day, amount + 12288);
      this.db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?)').run(task.taskId, task.ownerUid, task.status, task.priority, task.createdAt, snapshot);
      if (key) this.db.prepare('INSERT INTO receipts VALUES(?,?,?,?,?)').run(task.ownerUid, digest(key), fingerprint, task.taskId, now + DAY);
      this.prune(now);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  save(task: VaosTask) {
    const snapshot = JSON.stringify(task);
    if (Buffer.byteLength(snapshot) > 128 * 1024) throw new Error('QUEUE_RESULT_TOO_LARGE');
    const result = this.db.prepare('UPDATE tasks SET status=?,snapshot=? WHERE task_id=? AND owner_uid=?')
      .run(task.status, snapshot, task.taskId, task.ownerUid);
    if (result.changes !== 1) throw new Error('QUEUE_TASK_NOT_FOUND');
  }
  prune(now = Date.now()) {
    this.db.prepare(`DELETE FROM tasks WHERE ${TERMINAL} AND created_at<?`).run(now - DAY);
    for (const row of this.db.prepare(`SELECT DISTINCT owner_uid FROM tasks WHERE ${TERMINAL}`).all())
      this.db.prepare(`DELETE FROM tasks WHERE task_id IN (SELECT task_id FROM tasks WHERE owner_uid=? AND ${TERMINAL} ORDER BY created_at DESC,rowid DESC LIMIT -1 OFFSET 100)`).run(row.owner_uid as string);
    this.db.exec(`DELETE FROM tasks WHERE task_id IN (SELECT task_id FROM tasks WHERE ${TERMINAL} ORDER BY created_at DESC,rowid DESC LIMIT -1 OFFSET 1000)`);
  }
  close() { if (!this.closed) { this.closed = true; this.db.close(); } }
}
