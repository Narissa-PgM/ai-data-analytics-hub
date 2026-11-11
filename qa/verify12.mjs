// qa/verify12.mjs — "Forget everything" must leave no previous job in any draft, export or build prompt.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const DL = path.resolve('reports/downloads-verify12');
fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });
const OLD = 'Director of Stewardship Reporting\nCascade Health Network — Office of Philanthropy\n\nResponsibilities\n- Lead donor reporting and gift agreement compliance for 40,000+ donors\n- Partner with gift officers on donor impact reports\n\nQualifications\n- 10+ years in advancement services and gift accounting';
const NEWJOB = 'Chief Research Enablement Officer (CREO) REF: 003413SR\nHarvard Kennedy School — Cambridge, Massachusetts\n\nResponsibilities\n- Lead research administration, research computing and library services\n- Own research integrity and sponsored research compliance\n\nQualifications\n- 10+ years in research administration in higher education';
const OLD_TOKENS = ['Cascade', 'Stewardship', 'donor', 'gift officer'];
const hasOld = (t) => OLD_TOKENS.filter((x) => String(t || '').includes(x));
const checks = [];
const add = (n, p, i) => { checks.push({ n, p: !!p, i }); console.log(`${p ? 'PASS' : 'FAIL'} ${n} :: ${JSON.stringify(i).slice(0, 300)}`); };
const files = () => fs.readdirSync(DL);

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
try {
  await page.init();
  await browser.conn.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
  await page.conn.send('Page.enable', {}, page.sessionId).catch(() => {});
  page.conn.on('Page.javascriptDialogOpening', () => page.conn.send('Page.handleJavaScriptDialog', { accept: true }, page.sessionId).catch(() => {}));
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1600 });
  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(900);
  await page.evaluate(`(() => { const t=document.getElementById('jfPaste'); t.value=${JSON.stringify(OLD)}; t.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('jfAddPaste').click(); })()`);
  await sleep(2600);

  // build old drafts everywhere
  await page.evaluate(`document.getElementById('viewCareer').click()`); await sleep(1200);
  await page.evaluate(`(() => { document.getElementById('cSample').click(); document.getElementById('cJob').value=${JSON.stringify(OLD)}; document.getElementById('cCompany').value='Cascade Health Network'; document.getElementById('cRole').value='Director of Stewardship Reporting'; document.getElementById('cGenerate').click(); })()`);
  await sleep(1800);
  await page.evaluate(`document.getElementById('viewWorkSample').click()`); await sleep(2400);
  const wsOld = await page.evaluate(`(() => ({ role: document.getElementById('wsRole').value, prompt: (document.getElementById('wsPrompt').textContent||'').length }))()`);
  add('old drafts exist before clearing', /Stewardship/.test(wsOld.role) && wsOld.prompt > 1000, { role: wsOld.role });

  // forget everything
  await page.evaluate(`document.getElementById('viewJobFit').click()`); await sleep(800);
  await page.evaluate(`document.getElementById('jfClear').click()`);
  await sleep(2000);

  // work-sample drafts must be blank, with placeholders, and its storage gone
  const wsCleared = await page.evaluate(`(() => ({
    role: document.getElementById('wsRole').value, org: document.getElementById('wsOrg').value, jd: document.getElementById('wsJD').value,
    mission: document.getElementById('wsMission').value, plan: document.getElementById('wsPlan').value,
    spec: (document.getElementById('wsSpec').textContent || '').slice(0, 120),
    prompt: (document.getElementById('wsPrompt').textContent || '').slice(0, 120),
    briefStore: localStorage.getItem('ep_worksample_v1'),
    applyStore: localStorage.getItem('ep_apply_auto_v1'),
    domainStore: localStorage.getItem('ep_ws_domain_v1'),
  }))()`);
  add('work-sample brief is cleared', !wsCleared.role && !wsCleared.org && !wsCleared.jd && !wsCleared.mission && !wsCleared.plan, { role: wsCleared.role, jd: wsCleared.jd });
  add('work-sample spec + build prompt reset to placeholders', /Nothing built yet/i.test(wsCleared.spec) && /Fill the brief/i.test(wsCleared.prompt), { spec: wsCleared.spec, prompt: wsCleared.prompt });
  add('work-sample storage is cleared', !wsCleared.briefStore && !wsCleared.applyStore && !wsCleared.domainStore, { brief: !!wsCleared.briefStore, apply: !!wsCleared.applyStore, domain: !!wsCleared.domainStore });

  // career drafts cleared; export blocked instead of exporting old work
  const careerCleared = await page.evaluate(`(() => ({
    job: document.getElementById('cJob').value, resume: document.getElementById('cResume').value, company: document.getElementById('cCompany').value,
    output: (document.getElementById('cOutput').textContent || '').trim().slice(0, 120),
    nameKept: document.getElementById('cName').value || '',
  }))()`);
  add('career job/resume drafts are cleared (identity kept)', !careerCleared.job && !careerCleared.resume && !careerCleared.company && !!careerCleared.nameKept, { name: careerCleared.nameKept, job: careerCleared.job });
  const before = files().length;
  await page.evaluate(`document.getElementById('viewCareer').click()`); await sleep(900);
  await page.evaluate(`document.getElementById('cExportResume').click()`);
  await sleep(1200);
  const toast1 = await page.evaluate(`(document.getElementById('toast') || {}).textContent || ''`);
  add('career export is blocked with an explanation when nothing is generated', files().length === before && /Generate a career package first/i.test(toast1), { toast: toast1, files: files() });

  // add a brand-new job: work sample must follow it
  await page.evaluate(`document.getElementById('viewJobFit').click()`); await sleep(800);
  await page.evaluate(`(() => { const t=document.getElementById('jfPaste'); t.value=${JSON.stringify(NEWJOB)}; t.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('jfAddPaste').click(); })()`);
  await sleep(2800);
  await page.evaluate(`document.getElementById('viewWorkSample').click()`); await sleep(2600);
  const wsNew = await page.evaluate(`(() => ({ role: document.getElementById('wsRole').value, jd: document.getElementById('wsJD').value, prompt: (document.getElementById('wsPrompt').textContent||'').slice(0, 800), spec: (document.getElementById('wsSpec').textContent||'').slice(0, 800) }))()`);
  add('work sample follows the new job', /Chief Research Enablement/.test(wsNew.role) && /research administration/i.test(wsNew.jd), { role: wsNew.role });
  add('build prompt + spec carry no old-job text', hasOld(wsNew.prompt + ' ' + wsNew.spec).length === 0, { old: hasOld(wsNew.prompt + ' ' + wsNew.spec) });

  // career staleness guard: build for one input set, change the job, export is refused
  await page.evaluate(`document.getElementById('viewCareer').click()`); await sleep(900);
  await page.evaluate(`(() => { document.getElementById('cSample').click(); document.getElementById('cJob').value=${JSON.stringify(NEWJOB)}; document.getElementById('cCompany').value='Harvard Kennedy School'; document.getElementById('cRole').value='Chief Research Enablement Officer'; document.getElementById('cGenerate').click(); })()`);
  await sleep(1800);
  await page.evaluate(`(() => { document.getElementById('cRole').value='A Different Role Entirely'; })()`);
  const before2 = files().length;
  await page.evaluate(`document.getElementById('cExportResume').click()`);
  await sleep(1200);
  const toast2 = await page.evaluate(`(document.getElementById('toast') || {}).textContent || ''`);
  add('export is refused when inputs changed after generation', files().length === before2 && /different inputs/i.test(toast2), { toast: toast2 });
  add('no console errors', page.allErrors().length === 0, { errors: page.allErrors().map((e) => String(e.text).slice(0, 120)) });
} catch (e) {
  add('fatal', false, { error: e.message });
} finally {
  await browser.close();
  const s = { total: checks.length, passed: checks.filter((c) => c.p).length, failed: checks.filter((c) => !c.p) };
  fs.writeFileSync(path.resolve('reports/verify12.json'), JSON.stringify({ checks, summary: s }, null, 2));
  console.log(JSON.stringify(s));
}
