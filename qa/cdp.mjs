// qa/lib/cdp.mjs — dependency-free Chrome DevTools Protocol client.
// Node 26 provides global fetch + WebSocket; nothing to install.
//
// NOTE ON BROWSER CHOICE: this sandbox runs processes at Low Mandatory Level and
// denies the named-pipe operations Chrome's Crashpad needs. Chrome 156 therefore
// aborts during startup ("crash server failed to launch, self-terminating").
// Edge 156 is the same Chromium engine and starts fine, so the harness falls back
// to Edge. The fallback is recorded in every result file.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { sleep };

export const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
export const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

/** Poll until `fn` returns truthy or timeout. */
export async function waitFor(fn, { timeout = 30000, interval = 100, label = 'condition' } = {}) {
  const deadline = Date.now() + timeout;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) { lastErr = e; }
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${label}${lastErr ? ` (last error: ${lastErr.message})` : ''}`);
}

export class CDPConnection {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map(); // method -> [fn]
    this.closed = false;
  }

  async connect() {
    // Node's global WebSocket (undici) — available in Node >= 22.
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('WebSocket open timeout')), 15000);
      this.ws.onopen = () => { clearTimeout(t); resolve(); };
      this.ws.onerror = (ev) => { clearTimeout(t); reject(new Error('WebSocket error: ' + (ev?.message || 'unknown'))); };
    });
    this.ws.onmessage = (ev) => this._onMessage(ev.data);
    this.ws.onclose = () => {
      this.closed = true;
      for (const [, p] of this.pending) p.reject(new Error('CDP connection closed'));
      this.pending.clear();
    };
    return this;
  }

  _onMessage(data) {
    let msg;
    try { msg = JSON.parse(typeof data === 'string' ? data : data.toString()); } catch { return; }
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${msg.error.message} (code ${msg.error.code})`));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method) {
      const hs = this.listeners.get(msg.method);
      if (hs) for (const h of hs) { try { h(msg.params, msg.sessionId); } catch { /* listener error ignored */ } }
      const all = this.listeners.get('*');
      if (all) for (const h of all) { try { h(msg); } catch { /* ignore */ } }
    }
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
    return () => {
      const arr = this.listeners.get(method) || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    };
  }

  send(method, params = {}, sessionId) {
    if (this.closed) return Promise.reject(new Error('CDP connection closed'));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      try { this.ws.send(JSON.stringify(payload)); } catch (e) { this.pending.delete(id); reject(e); }
    });
  }

  close() {
    try { this.ws?.close(); } catch { /* ignore */ }
  }
}

/**
 * Launch a Chromium-family browser headless with CDP over a local port.
 * `port: 0` uses an ephemeral port discovered through DevToolsActivePort;
 * a fixed port (e.g. 9333) is polled through the HTTP endpoint instead.
 * Returns { conn, sessionId, proc, userDataDir, browser, browserVersion, port,
 *           pageTargetId, close }.
 */
export async function launchBrowser({
  browserPath = EDGE_PATH,
  browserName = 'edge',
  userDataDir,
  port = 0,
  windowSize = '1440,900',
  extraArgs = [],
} = {}) {
  if (!fs.existsSync(browserPath)) throw new Error(`Browser not found: ${browserPath}`);
  userDataDir = userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-qa-profile-'));
  fs.mkdirSync(userDataDir, { recursive: true });

  const args = [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-crash-reporter',
    '--disable-breakpad',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--metrics-recording-only',
    '--mute-audio',
    '--allow-file-access-from-files',
    '--disable-features=Translate,MediaRouter',
    '--user-data-dir=' + userDataDir,
    '--window-size=' + windowSize,
    ...extraArgs,
    'about:blank',
  ];

  // stdio must be 'ignore': the DSH sandbox denies piped stdio (spawn EPERM).
  const proc = spawn(browserPath, args, { stdio: 'ignore' });
  let spawnError = null;
  proc.on('error', (e) => { spawnError = e; });
  let exited = false;
  proc.on('exit', () => { exited = true; });

  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  let resolvedPort = port;
  if (!resolvedPort) {
    const info = await waitFor(() => {
      if (spawnError) throw spawnError;
      if (exited) throw new Error('browser process exited before DevToolsActivePort was written (sandbox cannot create Chromium IPC pipes?)');
      if (!fs.existsSync(portFile)) return null;
      const raw = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
      if (raw.length < 2) return null;
      return { port: raw[0] };
    }, { timeout: 30000, label: 'DevToolsActivePort' });
    resolvedPort = Number(info.port);
  }

  const versionInfo = await waitFor(async () => {
    if (spawnError) throw spawnError;
    const res = await fetch(`http://127.0.0.1:${resolvedPort}/json/version`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    return await res.json();
  }, { timeout: 30000, label: `CDP HTTP endpoint on 127.0.0.1:${resolvedPort}` });

  const wsUrl = versionInfo.webSocketDebuggerUrl || `ws://127.0.0.1:${resolvedPort}/devtools/browser/`;
  const conn = await new CDPConnection(wsUrl).connect();
  await conn.send('Target.setDiscoverTargets', { discover: false });

  const { targetId } = await conn.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await conn.send('Target.attachToTarget', { targetId, flatten: true });

  const cleanupProfile = () => {
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try { fs.rmSync(userDataDir, { recursive: true, force: true }); return; }
        catch { /* retry */ }
      }
    } catch { /* best effort */ }
  };

  return {
    conn,
    sessionId,
    proc,
    userDataDir,
    browser: browserName,
    browserVersion: String(versionInfo.Browser || ''),
    port: resolvedPort,
    pageTargetId: targetId,
    async close() {
      try { await conn.send('Browser.close'); } catch { /* ignore */ }
      conn.close();
      try { proc.kill(); } catch { /* ignore */ }
      await sleep(400);
      cleanupProfile();
    },
  };
}

/** High-level page driver bound to one CDP session. */
export class PageDriver {
  constructor(browser) {
    this.browser = browser;
    this.conn = browser.conn;
    this.sessionId = browser.sessionId;
    this.consoleEvents = [];
    this._seq = 0;
    this._wireEvents();
  }

  _wireEvents() {
    const push = (type, detail) => {
      const ev = { seq: ++this._seq, type, ts: Date.now(), ...detail };
      this.consoleEvents.push(ev);
      return ev;
    };
    this.conn.on('Runtime.consoleAPICalled', (p, sid) => {
      if (sid && sid !== this.sessionId) return;
      if (p.type !== 'error' && p.type !== 'warning') return;
      const text = (p.args || []).map((a) => {
        if (a.value !== undefined) return typeof a.value === 'string' ? a.value : JSON.stringify(a.value);
        return a.description || a.type || '';
      }).join(' ');
      push(p.type === 'error' ? 'console.error' : 'console.warn', { text, url: p.stackTrace?.callFrames?.[0]?.url, line: p.stackTrace?.callFrames?.[0]?.lineNumber });
    });
    this.conn.on('Runtime.exceptionThrown', (p, sid) => {
      if (sid && sid !== this.sessionId) return;
      const d = p.exceptionDetails || {};
      push('exception', {
        text: d.exception?.description || d.text || 'Uncaught exception',
        url: d.url, line: d.lineNumber, col: d.columnNumber,
      });
    });
    this.conn.on('Log.entryAdded', (p, sid) => {
      if (sid && sid !== this.sessionId) return;
      const e = p.entry || {};
      if (e.level !== 'error') return;
      push('log.error', { text: e.text, url: e.url, source: e.source, line: e.lineNumber });
    });
  }

  mark() { return this.consoleEvents.length; }
  since(mark) { return this.consoleEvents.slice(mark); }
  errorsSince(mark) {
    return this.since(mark).filter((e) => e.type !== 'console.warn');
  }
  allErrors() {
    return this.consoleEvents.filter((e) => e.type !== 'console.warn');
  }

  async init() {
    await this.conn.send('Page.enable', {}, this.sessionId);
    await this.conn.send('Runtime.enable', {}, this.sessionId);
    await this.conn.send('Log.enable', {}, this.sessionId);
    await this.conn.send('DOM.enable', {}, this.sessionId);
    await this.conn.send('Emulation.setFocusEmulationEnabled', { enabled: true }, this.sessionId).catch(() => {});
  }

  async evaluate(expression, { awaitPromise = true, returnByValue = true, timeoutMs = 30000 } = {}) {
    const res = await this.conn.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue,
      userGesture: true,
      timeout: timeoutMs,
    }, this.sessionId);
    if (res.exceptionDetails) {
      const d = res.exceptionDetails;
      const err = new Error(`evaluate exception: ${d.exception?.description || d.text || 'unknown'}`);
      err.exception = d;
      throw err;
    }
    return res.result?.value;
  }

  /** Evaluate and keep the exception in-band instead of throwing. */
  async evalSafe(expression, opts) {
    try { return { ok: true, value: await this.evaluate(expression, opts) }; }
    catch (e) { return { ok: false, error: e.message, exception: e.exception }; }
  }

  /** Poll a boolean expression in the page until it is truthy. */
  async waitForFunction(expression, { timeout = 10000, interval = 100, label } = {}) {
    return waitFor(() => this.evaluate(expression), {
      timeout, interval, label: label || String(expression).slice(0, 80),
    });
  }

  async navigate(url, { settleMs = 1200 } = {}) {
    const loaded = new Promise((resolve) => {
      const off = this.conn.on('Page.loadEventFired', (p, sid) => {
        if (sid && sid !== this.sessionId) return;
        off();
        resolve();
      });
      setTimeout(() => { off(); resolve(); }, 20000);
    });
    const nav = await this.conn.send('Page.navigate', { url }, this.sessionId);
    if (nav.errorText) throw new Error(`navigation failed: ${nav.errorText}`);
    await loaded;
    await sleep(settleMs);
    return nav;
  }

  async reload({ settleMs = 1500 } = {}) {
    const loaded = new Promise((resolve) => {
      const off = this.conn.on('Page.loadEventFired', (p, sid) => {
        if (sid && sid !== this.sessionId) return;
        off();
        resolve();
      });
      setTimeout(() => { off(); resolve(); }, 20000);
    });
    await this.conn.send('Page.reload', { ignoreCache: true }, this.sessionId);
    await loaded;
    await sleep(settleMs);
  }

  async setViewport(width, height, { mobile = false, deviceScaleFactor = 1 } = {}) {
    await this.conn.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor, mobile,
      screenWidth: width, screenHeight: height,
    }, this.sessionId);
    await sleep(250);
  }

  async clearViewport() {
    await this.conn.send('Emulation.clearDeviceMetricsOverride', {}, this.sessionId);
  }

  async screenshot(filePath) {
    const res = await this.conn.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, this.sessionId);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    return filePath;
  }

  async pressKey(key, { code = key, keyCode = 0 } = {}) {
    const vk = keyCode || (key === 'Escape' ? 27 : key === 'Tab' ? 9 : key === 'Enter' ? 13 : 0);
    await this.conn.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
    }, this.sessionId);
    await this.conn.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
    }, this.sessionId);
  }
}
