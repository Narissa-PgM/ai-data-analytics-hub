// qa/probe-stale2.mjs — why does the Apply auto-fill not refresh on job switch?
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const B = 'Director of Stewardship Reporting\nCascade Health Network — Office of Philanthropy, Boston, MA\n\nAbout the role\nCascade Health Network seeks a Director of Stewardship Reporting to lead donor reporting, gift agreement compliance and restricted fund stewardship across the system.\n\nResponsibilities\n- Lead the stewardship reporting program for 40,000+ donors and 1,200 endowed funds\n- Own gift agreement compliance, restricted fund reconciliation and Raiser\u2019s Edge data quality\n- Partner with philanthropy officers on impact reporting and donor communications\n- Build dashboards used by the Chief Philanthropy Officer\n- Manage five reporting analysts\n\nQualifications\n- 10+ years in advancement services or gift accounting\n- Expert in Raiser\u2019s Edge, SQL, Tableau\n- Bachelor\u2019s degree required';

const snap = `(w) => {
  const s = document.querySelector('[data-apx="' + w + '"]');
  const st = document.querySelector('[data-apx-st="' + w + '"]');
  const auto = document.querySelector('[data-apx-auto="' + w + '"]');
  const pick = (id) => { const el = document.getElementById(id); return el ? { v: String(el.value || '').replace(/\\s+/g,' ').slice(0, 70), auto: el.dataset.apAuto || '', user: el.dataset.apUser || '' } : null; };
  return {
    w,
    bar: s ? (s.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 90) : '(no bar)',
    status: st ? (st.textContent || '').trim().slice(0, 160) : '(no status)',
    autoChecked: auto ? !!auto.checked : null,
    fields: w === 'ws' ? { wsRole: pick('wsRole'), wsJD: pick('wsJD'), wsSpecify: pick('wsSpecify') } : (w === 'fit' ? { fitRole: pick('fitRole'), fitJD: pick('fitJD') } : { cJob: pick('cJob'), cRole: pick('cRole') }),
    prompt: (() => { const p = document.getElementById(w === 'ws' ? 'wsPrompt' : (w === 'fit' ? 'fitPromptCards' : 'cOutput')); return p ? (p.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 90) : null; })(),
  };
}`;

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const out = {};
try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2200);
  out.jobA = await page.evaluate(`(() => { const c=document.querySelector('#jfJobs .jf-job.sel'); return c ? c.textContent.replace(/\\s+/g,' ').trim().slice(0,70) : ''; })()`);
  for (const [v, w] of [['viewWorkSample', 'ws'], ['viewCareer', 'career'], ['viewFit', 'fit']]) {
    await page.evaluate(`document.getElementById('${v}').click()`);
    await sleep(1800);
    out['A_' + w] = await page.evaluate(`(${snap})('${w}')`);
  }
  // add job B
  await page.evaluate(`(() => { const t=document.getElementById('jfPaste'); t.value=${JSON.stringify(B)}; t.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('jfAddPaste').click(); })()`);
  await sleep(2600);
  out.jobB = await page.evaluate(`(() => { const c=document.querySelector('#jfJobs .jf-job.sel'); return c ? c.textContent.replace(/\\s+/g,' ').trim().slice(0,70) : ''; })()`);
  out.storage = await page.evaluate(`(() => { const k = Object.keys(localStorage).filter(x => /apx|workspace|ep_/i.test(x)); const v = {}; k.forEach(x => { try { v[x] = String(localStorage.getItem(x)).slice(0, 160); } catch(e) {} }); return v; })()`);
  for (const [v, w] of [['viewWorkSample', 'ws'], ['viewCareer', 'career'], ['viewFit', 'fit']]) {
    await page.evaluate(`document.getElementById('${v}').click()`);
    await sleep(2200);
    out['B_' + w] = await page.evaluate(`(${snap})('${w}')`);
  }
  // click the in-app "Fill & build" button on ws to see if manual works
  await page.evaluate(`(() => { const b = document.querySelector('[data-apx-go="ws"]'); if (b) b.click(); })()`);
  await sleep(2200);
  out.wsManual = await page.evaluate(`(${snap})('ws')`);
  out.errors = page.allErrors().map((e) => String(e.text).slice(0, 200));
} catch (e) { out.fatal = e.stack || e.message; }
finally {
  await browser.close();
  fs.writeFileSync(path.resolve('reports/probe-stale2.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 7000));
}
