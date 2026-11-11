// qa/facts.mjs — verify disputed audit claims at runtime.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = process.argv[2] || path.resolve('AI_Pilot.html');
const url = pathToFileURL(FILE).href;
const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const out = {};
try {
  await page.init();
  // record network activity (requests the app itself makes)
  const net = [];
  page.conn.on('Network.requestWillBeSent', (p) => { if (!/^(file|data):/.test(p.request.url)) net.push(p.request.url.slice(0, 140)); });
  await page.conn.send('Network.enable', {}, page.sessionId);
  await page.navigate(url, { settleMs: 1500 });
  out.commandsLength = await page.evaluate('typeof COMMANDS !== "undefined" ? COMMANDS.length : null').catch((e) => 'ERR ' + e.message);
  out.groupCounts = await page.evaluate(`(() => {
    const c = new Map();
    for (const x of COMMANDS) c.set(x.group, (c.get(x.group) || 0) + 1);
    return Object.fromEntries(c);
  })()`);
  out.navBadges = await page.evaluate(`[...document.querySelectorAll('.nav-group-head small')].map(e => e.textContent.trim())`);
  out.railCounts = await page.evaluate(`[...document.querySelectorAll('#navigation .nav')].map(b => ({ label: b.textContent.replace(/\\s+/g,' ').trim() })).slice(0, 10)`);
  out.totalLabel = await page.evaluate(`document.getElementById('totalNumber').textContent`);
  out.resultLabel = await page.evaluate(`document.getElementById('resultCount').textContent.trim()`);
  // click Learning category and read the filter label
  out.learningFilter = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('#navigation .nav')].find(x => /Learning/i.test(x.textContent));
    if (!b) return 'no learning button';
    b.click();
    return document.getElementById('resultCount').textContent.replace(/\\s+/g,' ').trim();
  })()`);
  await sleep(400);
  out.learningFilterAfter = await page.evaluate(`document.getElementById('resultCount').textContent.replace(/\\s+/g,' ').trim()`);
  // meta description + static placeholder + csv filename source
  out.meta = await page.evaluate(`document.querySelector('meta[name=description]').content`);
  out.placeholder = await page.evaluate(`document.getElementById('search').placeholder`);
  out.promiseText = await page.evaluate(`(() => { const t=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && /uploaded anywhere/i.test(e.textContent||'')).map(e=>e.textContent.trim()); return t.slice(0,4); })()`);
  // Does anything in the app fetch external URLs? inspect source
  out.fetchCalls = await page.evaluate(`(() => { const s=[...document.querySelectorAll('script')].map(x=>x.textContent).join('\\n');
     return { fetch: (s.match(/fetch\\(/g)||[]).length, xhr: (s.match(/XMLHttpRequest/g)||[]).length, sendBeacon: (s.match(/sendBeacon/g)||[]).length,
              claude: (s.match(/claude\\.ai/gi)||[]).length, navigatorClipboard: (s.match(/clipboard\\.writeText/g)||[]).length }; })()`);
  out.networkRequests = net.slice(0, 20);
} catch (e) {
  out.fatal = e.stack || e.message;
} finally {
  try { await browser.close(); } catch {}
  fs.writeFileSync(path.resolve('reports/facts.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}
