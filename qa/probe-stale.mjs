// qa/probe-stale.mjs — switch from job A to job B, find old-job text left in prompt fields.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const A_TOKENS = ['Example University', 'Office of the Provost', 'Director of Analytics & Reporting'];
const B_TOKENS = ['Cascade Health', 'Director of Stewardship Reporting'];
const JOB_B = [
  'Director of Stewardship Reporting',
  'Cascade Health Network — Office of Philanthropy, Boston, MA',
  '',
  'About the role',
  'Cascade Health Network seeks a Director of Stewardship Reporting to lead donor reporting, gift agreement compliance and restricted fund stewardship across the system.',
  '',
  'Responsibilities',
  '- Lead the stewardship reporting program for 40,000+ donors and 1,200 endowed funds',
  '- Own gift agreement compliance, restricted fund reconciliation and Raiser\u2019s Edge data quality',
  '- Partner with philanthropy officers on impact reporting, annual fund reporting and donor communications',
  '- Build dashboards used by the Chief Philanthropy Officer and hospital leadership',
  '- Manage a team of five reporting analysts and oversee audit readiness',
  '',
  'Qualifications',
  '- 10+ years in advancement services, stewardship or gift accounting in healthcare or higher education',
  '- Expert in Raiser\u2019s Edge or similar CRM, SQL, Tableau and fund accounting',
  '- Experience with CASE standards, IRS substantiation rules and restricted gift compliance',
  '- Bachelor\u2019s degree required; master\u2019s preferred',
].join('\n');

const scan = `(() => {
  const A = ${JSON.stringify(A_TOKENS)};
  const B = ${JSON.stringify(B_TOKENS)};
  const out = [];
  const seen = new Set();
  const grab = (label, el) => {
    if (!el || seen.has(el)) return; seen.add(el);
    const v = 'value' in el && typeof el.value === 'string' && el.tagName !== 'DIV' ? el.value : (el.textContent || '');
    const aHit = A.filter((t) => v.includes(t));
    if (!aHit.length) return;
    const bHit = B.some((t) => v.includes(t));
    out.push({ label, id: el.id || '', cls: String(el.className).slice(0, 48), tag: el.tagName, aHit, bHit, head: v.replace(/\\s+/g, ' ').trim().slice(0, 120) });
  };
  // every editor / prompt surface + every panel's visible text blocks
  [...document.querySelectorAll('textarea, input[type=text], pre, code, [class*=prompt], [class*=Prompt]')].forEach((el) => grab('editor', el));
  ['jobFitPanel', 'careerPanel', 'workSamplePanel', 'fitPanel', 'admissPanel', 'enterprisePanel', 'analyzerPanel', 'auditPanel', 'qaPanel', 'pilotPanel'].forEach((id) => {
    const p = document.getElementById(id); if (!p) return;
    const t = (p.textContent || '');
    const aHit = A.filter((x) => t.includes(x));
    if (aHit.length) out.push({ label: 'panel-text', id, aHit, bHit: B.some((x) => t.includes(x)), chars: t.length });
  });
  return out;
})()`;

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const report = { file: FILE };
const step = async (name, fn, wait = 800) => { await fn(); await sleep(wait); };
try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });

  // 1. Job A = sample job; let every "Apply" workspace auto-build for it
  await step('sample', () => page.evaluate(`document.getElementById('jfSample').click()`), 2000);
  for (const v of ['viewCareer', 'viewWorkSample', 'viewFit', 'viewJobFit']) {
    await step(v, () => page.evaluate(`document.getElementById('${v}').click()`), 1500);
  }
  report.afterA = await page.evaluate(scan);

  // 2. Add job B and select it
  await page.evaluate(`(() => {
    const t = document.getElementById('jfPaste');
    t.value = ${JSON.stringify(JOB_B)};
    t.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('jfAddPaste').click();
  })()`);
  await sleep(2500);
  report.jobs = await page.evaluate(`(() => ({
    sel: (() => { const c = document.querySelector('#jfJobs .jf-job.sel'); return c ? c.textContent.replace(/\\s+/g,' ').trim().slice(0,90) : ''; })(),
    tray: [...document.querySelectorAll('#jfJobs .jf-job')].map(x => x.textContent.replace(/\\s+/g,' ').trim().slice(0,70)),
  }))()`);
  // explicit select of the new job if needed
  await page.evaluate(`(() => {
    const chips = [...document.querySelectorAll('#jfJobs .jf-job')];
    const b = chips.find(x => /Stewardship/i.test(x.textContent || ''));
    if (b && !b.classList.contains('sel')) b.click();
  })()`);
  await sleep(2000);
  report.afterB = await page.evaluate(scan);

  // 3. Visit each Apply workspace again (this is what should refresh the prompts)
  report.afterRefresh = {};
  for (const v of ['viewCareer', 'viewWorkSample', 'viewFit', 'viewJobFit']) {
    await step(v, () => page.evaluate(`document.getElementById('${v}').click()`), 1600);
    report.afterRefresh[v] = await page.evaluate(scan);
  }
  report.errors = page.allErrors().map((e) => String(e.text).slice(0, 160));
} catch (e) { report.fatal = e.stack || e.message; }
finally {
  await browser.close();
  fs.writeFileSync(path.resolve('reports/probe-stale.json'), JSON.stringify(report, null, 2));
  const brief = (r) => (r || []).map((x) => `${x.label}:${x.id || x.cls || ''}${x.bHit ? '' : ' [STALE]'} "${x.aHit.join('/')}"`).join('\n    ');
  console.log('SELECTED:', report.jobs?.sel);
  console.log('\n=== after job A (expected: A everywhere) ===\n  ' + brief(report.afterA));
  console.log('\n=== after switching to job B (A leftovers = stale) ===\n  ' + brief(report.afterB));
  console.log('\n=== after visiting each workspace again ===');
  for (const [v, r] of Object.entries(report.afterRefresh)) console.log('  ' + v + ':\n    ' + brief(r));
  if (report.fatal) console.log('FATAL', report.fatal);
}
