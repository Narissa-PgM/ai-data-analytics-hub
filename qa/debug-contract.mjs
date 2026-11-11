// qa/debug-contract.mjs — isolate whether parseContract or the UI wiring is at fault.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve('AI_Pilot.html');
const html = fs.readFileSync(FILE, 'utf8');
const extract = (name) => {
  const i = html.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let depth = 0, started = false;
  for (let k = i; k < html.length; k += 1) {
    if (html[k] === '{') { depth += 1; started = true; }
    else if (html[k] === '}') { depth -= 1; if (started && !depth) return html.slice(i, k + 1); }
  }
  return '';
};
const src = extract('parseContract');
const CONTRACT = [
  'Contract parties: CREO ↔ Dean\'s Office / Research Dean (sponsor)',
  'Contract period: 12 months from start date',
  'Baseline rule: Every metric needs a baseline within 60 days.',
  '',
  'Priority 1 — Integrate research & library services into one coherent ecosystem',
  'Source: HKS 2036',
  '',
  'Element\tContract term',
  'Specific\tPublish a single service catalog.',
  'Measurable\tCatalog published; 90% of services have an owner.',
  'Achievable\tPhased: draft by day 90, live by month 6.',
  'Relevant\tEnables efficient research ecosystem language.',
  'Time-bound\tDraft day 90; live month 6.',
  'Evaluated\t90-day review, 6-month review.',
  'Revised\tIf awareness below 50%, re-scope and extend by a quarter.',
  '',
  'Priority 2 — Reduce time-to-research',
  'Source: posting',
  '',
  'Specific\tMap three research start paths.',
  'Measurable\tMedian cycle time reduced 25%.',
  'Achievable\tBaseline in 60 days.',
  'Relevant\tCore enablement mandate.',
  'Time-bound\tBaseline day 60; all paths by month 12.',
  'Evaluated\tQuarterly dashboard.',
  'Revised\tRe-target to steps within control.',
  '',
  'Governance of the contract itself',
  'Checkpoints: Day 60, Day 90, Month 6, Month 12.',
  'Change control: written revision note plus sponsor sign-off.',
].join('\n');

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const out = {};
try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });
  out.parser = await page.evaluate(`(() => {
    const esc = (s) => String(s == null ? '' : s);
    ${src}
    const c = parseContract(${JSON.stringify(CONTRACT)});
    return c ? { priorities: c.priorities.length, titles: c.priorities.map(p => p.n + ':' + p.title.slice(0, 40)), rows: c.priorities.map(p => p.rows.length), gov: c.governance.length, parties: c.header.parties } : null;
  })()`);

  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(800);
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2200);
  await page.evaluate(`document.getElementById('viewWorkSample').click()`);
  await sleep(1500);
  await page.evaluate(`(() => { const d=document.querySelector('[data-apx-det="ws"]'); if (d && d.getAttribute('aria-expanded') !== 'true') d.click(); })()`);
  await sleep(600);
  out.hasField = await page.evaluate(`!!document.getElementById('wsContract')`);
  await page.evaluate(`(() => { const c=document.getElementById('wsContract'); c.value=${JSON.stringify(CONTRACT)}; c.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  out.valueLen = await page.evaluate(`document.getElementById('wsContract').value.length`);
  out.before = await page.evaluate(`(() => ({ spec: (document.getElementById('wsSpec').textContent||'').slice(0,120), meter: (document.getElementById('wsMeterValue')||{}).textContent }))()`);
  await page.evaluate(`document.getElementById('wsBuild').click()`);
  await sleep(2200);
  out.after = await page.evaluate(`(() => ({
    status: (document.getElementById('wsStatus').textContent || '').slice(0, 160),
    specLen: (document.getElementById('wsSpec').textContent || '').length,
    specHead: (document.getElementById('wsSpec').textContent || '').slice(0, 200),
    hasContract: /SMARTER measurement contract/.test(document.getElementById('wsSpec').textContent || ''),
    promptHas: /SMARTER measurement contract/.test(document.getElementById('wsPrompt').textContent || ''),
    meter: (document.getElementById('wsMeterValue')||{}).textContent,
  }))()`);
  out.errors = page.allErrors().map((e) => String(e.text).slice(0, 200));
} catch (e) { out.fatal = e.stack || e.message; }
finally {
  await browser.close();
  console.log(JSON.stringify(out, null, 2).slice(0, 5000));
}
