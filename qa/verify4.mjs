// qa/verify4.mjs — switching jobs must refresh the Apply workspaces' fields AND prompts.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const A = ['Example University', 'Director of Analytics & Reporting'];
const B = ['Cascade Health', 'Director of Stewardship Reporting'];
const JOB_B = 'Director of Stewardship Reporting\nCascade Health Network — Office of Philanthropy, Boston, MA\n\nAbout the role\nCascade Health Network seeks a Director of Stewardship Reporting to lead donor reporting, gift agreement compliance and restricted fund stewardship across the system.\n\nResponsibilities\n- Lead the stewardship reporting program for 40,000+ donors and 1,200 endowed funds\n- Own gift agreement compliance, restricted fund reconciliation and Raiser\u2019s Edge data quality\n- Partner with philanthropy officers on impact reporting and donor communications\n- Build dashboards used by the Chief Philanthropy Officer\n- Manage five reporting analysts\n\nQualifications\n- 10+ years in advancement services or gift accounting\n- Expert in Raiser\u2019s Edge, SQL, Tableau\n- Bachelor\u2019s degree required';

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const checks = [];
const add = (n, p, i) => { checks.push({ n, p: !!p, i }); console.log(`${p ? 'PASS' : 'FAIL'} ${n} :: ${JSON.stringify(i).slice(0, 260)}`); };
const hasA = (t) => A.some((x) => t.includes(x));
const hasB = (t) => B.some((x) => t.includes(x));

try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });

  // 1. Job A, build the Work Sample prompt through the rail button
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2200);
  await page.evaluate(`document.getElementById('viewWorkSample').click()`);
  await sleep(2200);
  const aPrompt = await page.evaluate(`document.getElementById('wsPrompt').textContent || ''`);
  add('job A builds its own prompt', hasA(aPrompt), { head: aPrompt.replace(/\s+/g, ' ').slice(0, 80) });

  // 2. Switch to job B from Job Fit
  await page.evaluate(`document.getElementById('viewJobFit').click()`);
  await sleep(1200);
  await page.evaluate(`(() => { const t=document.getElementById('jfPaste'); t.value=${JSON.stringify(JOB_B)}; t.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('jfAddPaste').click(); })()`);
  await sleep(2600);
  await page.evaluate(`(() => { const c=[...document.querySelectorAll('#jfJobs .jf-job')].find(x=>/Stewardship/i.test(x.textContent||'')); if (c && !c.classList.contains('sel')) c.click(); })()`);
  await sleep(1800);

  // 3. THE BUG PATH: use the in-app handoff, not the rail
  const handoff = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('[data-jf-act="worksample"]')].find(x => x.getClientRects().length);
    if (!b) return 'no button visible';
    b.click(); return 'clicked: ' + b.textContent.trim();
  })()`);
  await sleep(2600);
  const afterHandoff = await page.evaluate(`(() => ({
    visible: !document.getElementById('workSamplePanel').hidden,
    role: document.getElementById('wsRole').value,
    prompt: document.getElementById('wsPrompt').textContent || '',
    specChars: (document.getElementById('wsSpec').textContent || '').length,
  }))()`);
  add('handoff opens Work Sample Studio', afterHandoff.visible, { handoff });
  add('handoff sets the new job title', hasB(afterHandoff.role) && !hasA(afterHandoff.role), { role: afterHandoff.role });
  add('handoff regenerates the build prompt for job B', hasB(afterHandoff.prompt) && !hasA(afterHandoff.prompt), { head: afterHandoff.prompt.replace(/\s+/g, ' ').slice(0, 90) });

  // 3b. Job Fit's own tabs must not show job A text for job B
  const tabNames = ['Fit dashboard', 'SMARTER program', 'Résumé & evidence', 'Cover letter', '30-60-90 plan', 'Job search & tracker'];
  const staleTabs = [];
  for (let i = 0; i < tabNames.length; i += 1) {
    await page.evaluate(`(() => { const t=[...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')][${i}]; if (t) t.click(); })()`);
    await sleep(800);
    const r = await page.evaluate(`(() => ({ text: document.getElementById('jfResult').textContent || '', cover: (document.getElementById('jfCoverEdit') || {}).value || '' }))()`);
    if (hasA(r.text) || hasA(r.cover)) staleTabs.push(tabNames[i]);
  }
  add('no old-job text left in Job Fit tabs', staleTabs.length === 0, { staleTabs });

  // 4. Career + Fit refresh on activation
  await page.evaluate(`document.getElementById('viewCareer').click()`);
  await sleep(2400);
  const career = await page.evaluate(`(() => ({ job: document.getElementById('cJob').value, role: document.getElementById('cRole').value, out: (document.getElementById('cOutput').textContent || '').slice(0, 400) }))()`);
  add('Career workspace follows the new job', hasB(career.job) && !hasA(career.job) && !hasA(career.out), { job: career.job.slice(0, 60), outHead: career.out.replace(/\s+/g, ' ').slice(0, 70) });

  await page.evaluate(`document.getElementById('viewFit').click()`);
  await sleep(2400);
  const fit = await page.evaluate(`(() => ({ jd: document.getElementById('fitJD').value, cards: (document.getElementById('fitPromptCards').textContent || '') }))()`);
  add('Career Fit follows the new job', hasB(fit.jd) && !hasA(fit.jd) && !hasA(fit.cards), { jd: fit.jd.replace(/\s+/g, ' ').slice(0, 60) });

  // 5. Rail path still works the other way round (switch back to A)
  await page.evaluate(`document.getElementById('viewJobFit').click()`);
  await sleep(1000);
  await page.evaluate(`(() => { const c=[...document.querySelectorAll('#jfJobs .jf-job')].find(x=>/Analytics & Reporting/i.test(x.textContent||'')); if (c) c.click(); })()`);
  await sleep(1800);
  await page.evaluate(`document.getElementById('viewWorkSample').click()`);
  await sleep(2400);
  const back = await page.evaluate(`(() => ({ role: document.getElementById('wsRole').value, prompt: document.getElementById('wsPrompt').textContent || '' }))()`);
  add('switching back restores job A content', hasA(back.role) && hasA(back.prompt) && !hasB(back.prompt), { role: back.role, head: back.prompt.replace(/\s+/g, ' ').slice(0, 70) });

  add('no console errors', page.allErrors().length === 0, { errors: page.allErrors().map((e) => String(e.text).slice(0, 120)) });
} catch (e) {
  add('fatal', false, { error: e.message });
} finally {
  await browser.close();
  const s = { total: checks.length, passed: checks.filter((c) => c.p).length, failed: checks.filter((c) => !c.p) };
  fs.writeFileSync(path.resolve('reports/verify4.json'), JSON.stringify({ checks, summary: s }, null, 2));
  console.log(JSON.stringify(s));
}
