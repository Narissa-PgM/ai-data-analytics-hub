// qa/probe-json.mjs — try realistic JSON payloads in the SMARTER program "Paste research JSON" box.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const payloads = {
  fenced: '```json\n{"organization":"HKS Example","mission":{"text":"To improve public policy and leadership.","url":"https://example.edu/mission"},"values":[{"name":"Excellence","url":"https://example.edu/values"}],"initiatives":[{"name":"Research Computing Initiative","description":"Integrate services","status":"current","timeframe":"2026","url":"https://example.edu/rc"}]}\n```',
  prose: 'Here is the JSON you asked for:\n\n{"organization":"HKS Example","mission":{"text":"To improve public policy.","url":"https://example.edu/mission"},"initiatives":[]}\n\nLet me know if you need more.',
  nested: '{"roleIntel":{"sources":["https://example.edu/org"]},"research":{"organization":"HKS Example","mission":{"text":"Nested mission text.","url":"https://example.edu/m"},"values":[{"name":"Truth","url":""}],"initiatives":[{"name":"Nested Initiative","status":"current","timeframe":"2026","url":""}]}}',
  curly: '{\u201corganization\u201d:\u201cHKS Example\u201d,\u201cmission\u201d:{\u201ctext\u201d:\u201cCurly mission.\u201d,\u201curl\u201d:\u201chttps://example.edu/m\u201d},\u201cinitiatives\u201d:[]}',
  trailingComma: '{"organization":"HKS Example","mission":{"text":"Trailing comma mission.","url":"https://example.edu/m"},"initiatives":[{"name":"TC Initiative","status":"current","url":""},],}',
};

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const out = {};
try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2400);

  for (const [name, payload] of Object.entries(payloads)) {
    // open the SMARTER program tab
    await page.evaluate(`(() => { const t=[...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].find(x=>/SMARTER program/i.test(x.textContent||'')); if (t) t.click(); })()`);
    await sleep(1200);
    // make sure the JSON box is open
    await page.evaluate(`(() => { const b=document.querySelector('[data-sm-act="rjsonshow"]'); const box=document.querySelector('.sm-json'); if (box && box.hidden && b) b.click(); })()`);
    await sleep(600);
    const res = await page.evaluate(`(() => {
      const ta = document.querySelector('[data-sm-json]');
      if (!ta) return { ok: false, why: 'no textarea' };
      ta.value = ${JSON.stringify(payload)};
      // capture toast text
      window.__toasts = [];
      const toastEl = document.getElementById('toast');
      const mo = new MutationObserver(() => { if (toastEl && toastEl.textContent) window.__toasts.push(toastEl.textContent); });
      if (toastEl) mo.observe(toastEl, { childList: true, characterData: true, subtree: true });
      const b = document.querySelector('[data-sm-act="rjson"]'); if (b) b.click();
      return { ok: true };
    })()`);
    await sleep(1800);
    const state = await page.evaluate(`(() => {
      const summary = document.querySelector('.sm-research summary');
      const missionEl = document.querySelector('[data-sm-r="mission"]');
      const toastEl = document.getElementById('toast');
      const status = document.querySelector('[data-sm-status]');
      return {
        summary: summary ? summary.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200) : '',
        mission: missionEl ? missionEl.value.slice(0, 120) : '',
        toast: toastEl ? toastEl.textContent : '',
        toasts: window.__toasts || [],
        status: status ? status.textContent.trim().slice(0, 120) : '',
      };
    })()`);
    out[name] = { res, state };
  }
  out.errors = page.allErrors().map((e) => String(e.text).slice(0, 160));
} catch (e) { out.fatal = e.stack || e.message; }
finally {
  await browser.close();
  fs.writeFileSync(path.resolve('reports/probe-json.json'), JSON.stringify(out, null, 2));
  for (const [k, v] of Object.entries(out)) {
    if (k === 'errors' || k === 'fatal') continue;
    console.log('\n=== ' + k + ' ===');
    console.log('  summary:', v.state.summary);
    console.log('  mission:', JSON.stringify(v.state.mission));
    console.log('  toast  :', v.state.toast);
    console.log('  status :', v.state.status);
  }
  console.log('\nerrors:', JSON.stringify(out.errors));
  if (out.fatal) console.log('FATAL', out.fatal);
}
