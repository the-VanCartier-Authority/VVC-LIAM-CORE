// Browser coverage is a separate, explicit gate; npm test remains the Node suite.
import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = (await readdir(new URL('../tests/', import.meta.url))).filter(name => name.endsWith('-browser.mjs')).sort();
if (!fixtures.length) throw new Error('NO_BROWSER_FIXTURES');
if (process.platform !== 'linux') throw new Error('BROWSER_SUPERVISOR_UNAVAILABLE: Linux subreaper/pidfd required');
const executable = process.env.CHROMIUM_EXECUTABLE_PATH || chromium.executablePath();
const fixtureTimeoutMs = 120000;
const killGraceMs = 500;
const cleanupBudgetMs = 3000;

// Python is only the Linux process supervisor; fixtures still execute in Node.
// PR_SET_CHILD_SUBREAPER makes even short-lived/detached orphans our children.
// pidfds pin signal targets; waitpid(ECHILD), not a /proc snapshot, proves cleanup.
// Isolated Python ignores user site packages/PYTHONPATH. FD 3 is supervisor-only.
const supervisorSource = String.raw`
import ctypes, errno, json, os, signal, sys, time
node, fixture = sys.argv[1:3]
timeout, grace, budget = (float(value) / 1000 for value in sys.argv[3:6])
interrupted = 0

def interrupt(signum, frame):
    global interrupted
    interrupted = interrupted or signum

try:
    libc = ctypes.CDLL(None, use_errno=True)
    libc.prctl.argtypes = [ctypes.c_int, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong]
    if libc.prctl(36, 1, 0, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), 'PR_SET_CHILD_SUBREAPER')
    enabled = ctypes.c_int()
    if libc.prctl(37, ctypes.addressof(enabled), 0, 0, 0) != 0 or enabled.value != 1:
        raise RuntimeError('subreaper verification failed')
    probe = os.pidfd_open(os.getpid())
    try:
        signal.pidfd_send_signal(probe, 0)
    finally:
        os.close(probe)
    def children():
        found = []
        # Some Linux kernels omit /proc/.../children. Adoption is enforced by
        # prctl; enumerate children of the *living supervisor*, not the dead fixture.
        for name in os.listdir('/proc'):
            if not name.isdecimal():
                continue
            try:
                with open('/proc/%s/stat' % name) as stream:
                    fields = stream.read().rsplit(')', 1)[1].split()
                if int(fields[1]) == os.getpid():
                    found.append(int(name))
            except (FileNotFoundError, ProcessLookupError, PermissionError):
                # Never infer completion from this scan. ECHILD must prove it;
                # an inaccessible live child therefore causes a cleanup failure.
                continue
        return found
    children()  # Fail before starting any fixture if supervision is unavailable.
    signal.signal(signal.SIGTERM, interrupt)
    signal.signal(signal.SIGINT, interrupt)
    started = time.monotonic()
    root_pid = os.fork()
except Exception as error:
    print('BROWSER_SUPERVISOR_UNAVAILABLE: %s' % error, file=sys.stderr)
    sys.exit(1)

if root_pid == 0:
    os.close(3)  # Fixture cannot retain or accidentally write the proof channel.
    signal.signal(signal.SIGTERM, signal.SIG_DFL)
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    try:
        os.execv(node, [node, fixture])
    except Exception:
        os._exit(127)

owned = {}  # pid -> (pidfd, first SIGTERM time); entries removed only after waitpid.
root_code = None
failure = None
cleanup_started = None
verified = False
while True:
    now = time.monotonic()
    if interrupted:
        failure = failure or 'BROWSER_FIXTURE_INTERRUPTED'
    elif root_code is None and now - started >= timeout:
        failure = failure or 'BROWSER_FIXTURE_TIMEOUT'
    try:
        # Only this supervisor reaps its children, preventing PID reuse between a
        # /proc children read and pidfd_open. Recheck PPID before first signalling.
        while True:
            try:
                pid, status = os.waitpid(-1, os.WNOHANG)
            except ChildProcessError:
                verified = True
                break
            if pid == 0:
                break
            if pid == root_pid:
                root_code = os.waitstatus_to_exitcode(status)
            entry = owned.pop(pid, None)
            if entry:
                os.close(entry[0])
        if verified:
            break
        if root_code is not None or failure:
            cleanup_started = cleanup_started if cleanup_started is not None else now
            for pid in children():
                if pid not in owned:
                    fd = os.pidfd_open(pid)
                    try:
                        with open('/proc/%s/stat' % pid) as stream:
                            fields = stream.read().rsplit(')', 1)[1].split()
                        if int(fields[1]) != os.getpid():
                            raise RuntimeError('child ownership changed before signalling')
                        owned[pid] = (fd, now)
                    except BaseException:
                        os.close(fd)
                        raise
            for fd, first_term in list(owned.values()):
                try:
                    signal.pidfd_send_signal(fd, signal.SIGKILL if now - first_term >= grace else signal.SIGTERM)
                except ProcessLookupError:
                    pass  # Exited children still have to be reaped, not assumed clean.
    except Exception as error:
        failure = 'BROWSER_FIXTURE_CLEANUP_FAILED: %s' % error
        cleanup_started = cleanup_started if cleanup_started is not None else now
    if cleanup_started is not None and now - cleanup_started >= budget:
        failure = 'BROWSER_FIXTURE_CLEANUP_FAILED: child reaping not verified'
        for fd, _ in list(owned.values()):
            try:
                signal.pidfd_send_signal(fd, signal.SIGKILL)
            except OSError:
                pass
        break
    time.sleep(0.01)

for fd, _ in owned.values():
    os.close(fd)
if interrupted:
    failure = failure or 'BROWSER_FIXTURE_INTERRUPTED'
if not verified or root_code is None:
    failure = failure or 'BROWSER_FIXTURE_CLEANUP_FAILED'
elif root_code != 0:
    failure = failure or 'BROWSER_FIXTURE_FAILED'
proof = {'supervisorPid': os.getpid(), 'cleanupVerified': verified,
         'remainingChildren': 0 if verified else None, 'python': sys.version.split()[0],
         'fixtureExit': root_code, 'failure': failure}
os.write(3, (json.dumps(proof) + '\n').encode())
if failure:
    print('%s: %s (fixture exit %s)' % (failure, fixture, root_code), file=sys.stderr)
sys.exit(128 + interrupted if interrupted else (1 if failure else 0))
`;

async function runFixture(fixture) {
  const child = spawn('python3', ['-I', '-u', '-c', supervisorSource, process.execPath,
    `tests/${fixture}`, String(fixtureTimeoutMs), String(killGraceMs), String(cleanupBudgetMs)], {
    cwd: root, stdio: ['ignore', 'inherit', 'inherit', 'pipe'], detached: true,
    env: { ...process.env, CHROMIUM_EXECUTABLE_PATH: executable,
      PLAYWRIGHT_CORE_PATH: fileURLToPath(new URL('../node_modules/playwright-core', import.meta.url)),
      GEMINI_API_KEY: '', NVIDIA_API_KEY: '', LLM_PROVIDERS_JSON: '[]' }
  });
  let spawnError, failure, evidence = '', forceDeadline;
  const closed = new Promise(resolve => {
    child.once('error', error => { spawnError = error; });
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  child.stdio[3].on('data', chunk => {
    if (evidence.length <= 8192) evidence += chunk;
  });
  const handlers = new Map(['SIGINT', 'SIGTERM'].map(name => [name, () => {
    failure ??= Object.assign(new Error(`BROWSER_FIXTURE_INTERRUPTED: ${fixture} (${name})`),
      { exitCode: name === 'SIGINT' ? 130 : 143 });
    if (child.exitCode === null && child.signalCode === null) child.kill(name);
  }]));
  for (const [name, handler] of handlers) process.on(name, handler);
  // Outer guard also bounds a broken supervisor. Its forced exit cannot yield PASS.
  const deadline = setTimeout(() => {
    failure ??= new Error(`BROWSER_SUPERVISOR_TIMEOUT: ${fixture}`);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    forceDeadline = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 1000);
  }, fixtureTimeoutMs + cleanupBudgetMs + 1000);
  try {
    const { code, signal } = await closed;
    if (failure) throw failure;
    if (spawnError) throw new Error(`BROWSER_SUPERVISOR_UNAVAILABLE: ${spawnError.message}`);
    let proof;
    try { proof = JSON.parse(evidence); } catch { /* Missing/invalid evidence fails closed below. */ }
    if (!proof || proof.supervisorPid !== child.pid || proof.cleanupVerified !== true || proof.remainingChildren !== 0) {
      throw new Error(`BROWSER_FIXTURE_CLEANUP_FAILED: ${fixture} (no verified supervisor proof)`);
    }
    if (code !== 0 || signal || proof.failure || proof.fixtureExit !== 0) {
      throw new Error(`${proof.failure || 'BROWSER_FIXTURE_FAILED'}: ${fixture} (${code ?? signal})`);
    }
    console.log(JSON.stringify({ fixture, cleanupVerified: true, remainingChildren: 0,
      supervisor: 'Linux subreaper/pidfd/waitpid', python: proof.python }));
  } finally {
    clearTimeout(deadline); clearTimeout(forceDeadline);
    for (const [name, handler] of handlers) process.off(name, handler);
    child.unref();
  }
}

console.log(JSON.stringify({ gate: 'Chromium fixtures', fixtures, executable, node: process.version }));
try {
  for (const fixture of fixtures) {
    console.log(`Browser fixture: tests/${fixture}`);
    await runFixture(fixture);
  }
  console.log(JSON.stringify({ browserGate: 'PASS', fixturesExecuted: fixtures.length }));
} catch (error) {
  console.error(error);
  process.exitCode = error.exitCode ?? 1;
}
