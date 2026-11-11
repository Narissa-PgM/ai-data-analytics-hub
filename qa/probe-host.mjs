// qa/probe-host.mjs — compare file:// vs http:// behaviour for one self-contained file.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const dir = path.dirname(FILE);
const port = 8731;
const server = http.createServer((req, res) => {
  const p = path.join(dir, decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'AI_Pilot.html');
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.statusCode = 404; res.end('nope'); return; }
  res.setHeader('Content-Type', p.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain');
  res.end(fs.readFileSync(p));
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const out = {};
const probe = `(() => {
  const ls = (() => { try { localStorage.setItem('__probe', '1'); const v = localStorage.getItem('__probe'); localStorage.removeItem('__probe'); return v === '1' ? 'works' : 'read-only'; } catch (e) { return 'blocked: ' + e.name; } })();
  return {
    url: location.href.slice(0, 80),
    secureContext: window.isSecureContext,
    clipboard: !!(navigator.clipboard && navigator.clipboard.writeText),
    localStorage: ls,
    indexedDB: typeof indexedDB !== 'undefined',
    fileSystemAccess: typeof window.showOpenFilePicker,
    downloadAttr: 'download' in document.createElement('a'),
    print: typeof window.print === 'function',
  };
})()`;
try {
  for (const [label, url] of [['file', pathToFileURL(FILE).href], ['http', `http://127.0.0.1:${port}/AI_Pilot.html`]]) {
    const page = new PageDriver(browser);
    await page.init();
    await page.navigate(url, { settleMs: 1500 });
    const env = await page.evaluate(probe);
    // external fetch as the app's optional URL inspector would do
    const net = await page.evalSafe(`fetch('https://example.com/', { mode: 'cors' }).then(r => 'ok ' + r.status).catch(e => 'error: ' + (e.message || e))`);
    // very small interaction smoke: open sample + check fixed checks panel
    await page.evaluate(`document.getElementById('jfUseProfile').click()`);
    await sleep(800);
    await page.evaluate(`document.getElementById('jfSample').click()`);
    await sleep(1800);
    const app = await page.evaluate(`(() => {
      const checks = [...document.querySelectorAll('#jfResult .jf-check')];
      return {
        resultChars: (document.getElementById('jfResult').textContent || '').length,
        checks: checks.length,
        fixedRows: checks.filter(c => c.getAttribute('data-fixed') === '1').length,
        smarterCard: /SMARTER format/i.test(document.getElementById('jfResult').textContent || ''),
        storageKeys: (() => { try { return Object.keys(localStorage).filter(k => k.startsWith('ep_')).length; } catch (e) { return 'n/a'; } })(),
      };
    })()`);
    out[label] = { env, externalFetch: net.ok ? net.value : net.error, app, errors: page.allErrors().map((e) => String(e.text).slice(0, 160)) };
    page.close?.();
  }
} finally {
  await browser.close();
  server.close();
  fs.writeFileSync(path.resolve('reports/probe-host.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 5000));
}
