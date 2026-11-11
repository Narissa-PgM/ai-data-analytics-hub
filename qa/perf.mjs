// qa/perf.mjs — CPU profile + load metrics for AI_Pilot.html
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = process.argv[2] || path.resolve('AI_Pilot.html');
const OUT = process.argv[3] || path.resolve('reports/perf.json');
const url = pathToFileURL(FILE).href;

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const out = { file: FILE, bytes: fs.statSync(FILE).size };
try {
  await page.init();
  await page.conn.send('Profiler.enable', {}, page.sessionId);
  await page.conn.send('Profiler.setSamplingInterval', { interval: 200 }, page.sessionId);
  await page.conn.send('Performance.enable', {}, page.sessionId);
  await page.conn.send('Emulation.setCPUThrottlingRate', { rate: 1 }, page.sessionId);

  const t0 = Date.now();
  await page.conn.send('Profiler.start', {}, page.sessionId);
  await page.navigate(url, { settleMs: 2500 });
  await page.waitForFunction('document.readyState === "complete"', { timeout: 30000 });
  await sleep(1500);
  out.wallMs = Date.now() - t0;
  const { profile } = await page.conn.send('Profiler.stop', {}, page.sessionId);
  fs.writeFileSync(path.resolve('reports/perf.cpuprofile'), JSON.stringify(profile));

  // Aggregate self time per function
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map(); // key -> ticks
  const parentOf = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parentOf.set(c, n.id);
  const dt = profile.timeDeltas || [];
  for (let i = 0; i < (profile.samples || []).length; i += 1) {
    const id = profile.samples[i];
    const node = byId.get(id);
    if (!node) continue;
    const cf = (node.callFrame && node.callFrame.functionName) || '(anonymous)';
    const key = `${cf} @${(node.callFrame && node.callFrame.lineNumber) || 0}`;
    self.set(key, (self.get(key) || 0) + (dt[i] || 0));
  }
  const total = [...self.values()].reduce((a, b) => a + b, 0) || 1;
  out.topSelf = [...self.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([k, us]) => ({ fn: k, ms: +(us / 1000).toFixed(1), pct: +((us / total) * 100).toFixed(1) }));

  // Renderer performance metrics
  const m = await page.conn.send('Performance.getMetrics', {}, page.sessionId);
  const pick = (name) => (m.metrics.find((x) => x.name === name) || {}).value;
  out.metrics = {
    TaskDuration: pick('TaskDuration'),
    ScriptDuration: pick('ScriptDuration'),
    LayoutDuration: pick('LayoutDuration'),
    RecalcStyleDuration: pick('RecalcStyleDuration'),
    JSHeapUsedSize: pick('JSHeapUsedSize'),
    Nodes: pick('Nodes'),
    Documents: pick('Documents'),
  };

  // Count DOM growth: what does each panel contain?
  out.dom = await page.evaluate(`(() => {
    const panels = [...document.querySelectorAll('main > section, main > div')].map(p => ({
      id: p.id || '(none)', hidden: !!p.hidden, nodes: p.getElementsByTagName('*').length,
    })).sort((a,b) => b.nodes - a.nodes);
    return { total: document.getElementsByTagName('*').length, panels };
  })()`);

  // Long tasks during load (fresh reload with observer injected before parse)
  await page.conn.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__lt=[];(()=>{try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push({s:+e.startTime.toFixed(0),d:+e.duration.toFixed(0)})}).observe({entryTypes:['longtask']})}catch(e){}})();`,
  }, page.sessionId);
  await page.reload({ settleMs: 2000 });
  out.longTasks = await page.evaluate('window.__lt || []');
  out.paint = await page.evaluate(`(() => {
    const p = performance.getEntriesByType('paint').reduce((a,e)=>(a[e.name]=+e.startTime.toFixed(1),a),{});
    const nav = performance.getEntriesByType('navigation')[0] || {};
    return { ...p, domInteractive: +(nav.domInteractive||0).toFixed(1), domContentLoaded: +(nav.domContentLoadedEventEnd||0).toFixed(1), loadEvent: +(nav.loadEventEnd||0).toFixed(1) };
  })()`);

  // Mobile-ish: 4x CPU throttle reload timing
  await page.conn.send('Emulation.setCPUThrottlingRate', { rate: 4 }, page.sessionId);
  const t1 = Date.now();
  await page.reload({ settleMs: 2000 });
  await page.waitForFunction('document.readyState === "complete"', { timeout: 30000 });
  out.throttled4xMs = Date.now() - t1;
  out.throttledPaint = await page.evaluate(`(() => {
    const p = performance.getEntriesByType('paint').reduce((a,e)=>(a[e.name]=+e.startTime.toFixed(1),a),{});
    const nav = performance.getEntriesByType('navigation')[0] || {};
    return { ...p, domContentLoaded: +(nav.domContentLoadedEventEnd||0).toFixed(1), loadEvent: +(nav.loadEventEnd||0).toFixed(1) };
  })()`);
  await page.conn.send('Emulation.setCPUThrottlingRate', { rate: 1 }, page.sessionId);
} catch (e) {
  out.error = e.stack || e.message;
} finally {
  try { await browser.close(); } catch {}
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ metrics: out.metrics, paint: out.paint, throttled4xMs: out.throttled4xMs, throttledPaint: out.throttledPaint, longTasks: out.longTasks?.slice(0, 15), top: out.topSelf?.slice(0, 15), error: out.error }, null, 2));
}
