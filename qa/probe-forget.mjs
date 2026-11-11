// qa/probe-forget.mjs — what still carries the previous job after "Forget everything"?
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve('AI_Pilot.html');
const DL = path.resolve('reports/downloads-forget');
fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });
const OLD = 'Director of Stewardship Reporting\nCascade Health Network — Office of Philanthropy, Boston, MA\n\nResponsibilities\n- Lead donor reporting and gift agreement compliance for 40,000+ donors and 1,200 endowed funds\n- Partner with gift officers on donor impact reports\n- Manage five reporting analysts\n\nQualifications\n- 10+ years in advancement services and gift accounting\n- Raiser\u2019s Edge, SQL, Tableau';
const NEWJOB = 'Chief Research Enablement Officer (CREO) REF: 003413SR\nHarvard Kennedy School — Cambridge, Massachusetts\n\nResponsibilities\n- Lead research administration, research computing and library services\n- Own research integrity and sponsored research compliance\n- Build a governed research data warehouse\n\nQualifications\n- 10+ years in research administration in higher education';
const OLD_TOKENS = ['Cascade', 'Stewardship', 'stewardship', 'donor', 'Donor', 'gift officer', 'Raiser'];
const hasOld = (t) => OLD_TOKENS.filter((x) => String(t || '').includes(x));

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const out = {};
try {
  await page.init();
  await browser.conn.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1600 });
  // accept confirms (Forget everything asks)
  page.conn.on('Page.javascriptDialogOpening', () => page.conn.send('Page.handleJavaScriptDialog', { accept: true }, page.sessionId).catch(() => {}));
  await page.conn.send('Page.enable', {}, page.sessionId).catch(() => {});

  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(900);
  await page.evaluate(`(() => { const t=document.getElementById('jfPaste'); t.value=${JSON.stringify(OLD)}; t.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('jfAddPaste').click(); })()`);
  await sleep(2600);

  // Career: a generated package and an exported résumé
  await page.evaluate(`document.getElementById('viewCareer').click()`);
  await sleep(1200);
  await page.evaluate(`(() => {
    document.getElementById('cSample').click();
    document.getElementById('cJob').value = ${JSON.stringify(OLD)};
    document.getElementById('cCompany').value = 'Cascade Health Network';
    document.getElementById('cRole').value = 'Director of Stewardship Reporting';
    document.getElementById('cGenerate').click();
  })()`);
  await sleep(2000);
  await page.evaluate(`(() => { const b=document.getElementById('cExportResume'); if (b) b.click(); })()`);
  await sleep(1800);

  // Work Sample Studio: built spec + prompt for the old job
  await page.evaluate(`document.getElementById('viewWorkSample').click()`);
  await sleep(2200);
  out.wsBefore = await page.evaluate(`(() => ({ role: document.getElementById('wsRole').value, prompt: (document.getElementById('wsPrompt').textContent||'').slice(0,200), spec: (document.getElementById('wsSpec').textContent||'').slice(0,160) }))()`);

  // Forget everything
  await page.evaluate(`document.getElementById('viewJobFit').click()`);
  await sleep(900);
  await page.evaluate(`document.getElementById('jfClear').click()`);
  await sleep(1500);
  out.afterClear = await page.evaluate(`(() => ({
    jobs: document.querySelectorAll('#jfJobs .jf-job').length,
    resultHead: (document.getElementById('jfResult').textContent || '').slice(0, 120),
    storedJobs: (() => { try { return (JSON.parse(localStorage.getItem('ep_jobfit_v1') || '{}').items || []).length; } catch (e) { return -1; } })(),
  }))()`);

  // Add a brand-new job
  await page.evaluate(`(() => { const t=document.getElementById('jfPaste'); t.value=${JSON.stringify(NEWJOB)}; t.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('jfAddPaste').click(); })()`);
  await sleep(2800);
  out.newJob = await page.evaluate(`(() => { const c=document.querySelector('#jfJobs .jf-job.sel'); return c ? c.textContent.replace(/\\s+/g,' ').trim().slice(0,70) : ''; })()`);

  // Work Sample Studio after the new job (without rebuilding)
  await page.evaluate(`document.getElementById('viewWorkSample').click()`);
  await sleep(2400);
  out.wsAfter = await page.evaluate(`(() => ({ role: document.getElementById('wsRole').value, org: document.getElementById('wsOrg').value, jd: (document.getElementById('wsJD').value||'').slice(0,120), mission: (document.getElementById('wsMission').value||'').slice(0,120), prompt: (document.getElementById('wsPrompt').textContent||'').slice(0,300), spec: (document.getElementById('wsSpec').textContent||'').slice(0,200) }))()`);

  // Career workspace after the new job
  await page.evaluate(`document.getElementById('viewCareer').click()`);
  await sleep(2400);
  out.careerAfter = await page.evaluate(`(() => ({ job: document.getElementById('cJob').value.slice(0,120), role: document.getElementById('cRole').value, company: document.getElementById('cCompany').value, output: (document.getElementById('cOutput').textContent||'').slice(0,300) }))()`);

  // Job Fit exports for the new job
  await page.evaluate(`document.getElementById('viewJobFit').click()`);
  await sleep(1200);
  await page.evaluate(`(() => { const t=[...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].find(x=>/r[eé]sum[eé]/i.test(x.textContent||'')); if (t) t.click(); })()`);
  await sleep(1200);
  await page.evaluate(`(() => { const b=document.querySelector('[data-jf-act="resumehtml"]'); if (b) b.click(); })()`);
  await sleep(1800);
  await page.evaluate(`(() => { const b=document.querySelector('[data-jf-act="worksampledl"]'); if (b) b.click(); })()`);
  await sleep(2200);

  const files = fs.readdirSync(DL);
  out.downloads = files.map((f) => {
    const t = fs.readFileSync(path.join(DL, f), 'utf8');
    return { file: f, bytes: t.length, oldTokens: hasOld(t) };
  });
  out.wsAfterOld = hasOld(out.wsAfter.role + ' ' + out.wsAfter.jd + ' ' + out.wsAfter.mission + ' ' + out.wsAfter.prompt + ' ' + out.wsAfter.spec);
  out.careerAfterOld = hasOld(out.careerAfter.job + ' ' + out.careerAfter.role + ' ' + out.careerAfter.company + ' ' + out.careerAfter.output);
  out.errors = page.allErrors().map((e) => String(e.text).slice(0, 200));
} catch (e) { out.fatal = e.stack || e.message; }
finally {
  await browser.close();
  fs.writeFileSync(path.resolve('reports/probe-forget.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 7000));
}
