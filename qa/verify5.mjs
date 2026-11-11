// qa/verify5.mjs — non-strong requirements must appear in prompt, pack and work-sample spec/prompt.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const DL = path.resolve('reports/downloads5');
fs.rmSync(DL, { recursive: true, force: true });
fs.mkdirSync(DL, { recursive: true });
const checks = [];
const add = (n, p, i) => { checks.push({ n, p: !!p, i }); console.log(`${p ? 'PASS' : 'FAIL'} ${n} :: ${JSON.stringify(i).slice(0, 300)}`); };

const JOB_B = 'Director of Stewardship Reporting\nCascade Health Network — Office of Philanthropy, Boston, MA\n\nAbout the role\nCascade Health Network seeks a Director of Stewardship Reporting to lead donor reporting, gift agreement compliance and restricted fund stewardship across the system.\n\nResponsibilities\n- Lead the stewardship reporting program for 40,000+ donors and 1,200 endowed funds\n- Own gift agreement compliance, restricted fund reconciliation and Raiser\u2019s Edge data quality\n- Partner with philanthropy officers on impact reporting and donor communications\n- Build dashboards used by the Chief Philanthropy Officer\n- Manage five reporting analysts\n\nQualifications\n- 10+ years in advancement services or gift accounting\n- Expert in Raiser\u2019s Edge, SQL, Tableau\n- Bachelor\u2019s degree required';

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
try {
  await page.init();
  await browser.conn.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });
  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(1000);
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2400);
  let weak = await page.evaluate(`(() => { const s = window.EPJobFit.analysis(); return s && s.a ? s.a.reqs.filter(r => r.status !== 'strong').length : -1; })()`);
  if (weak <= 0) {
    await page.evaluate(`(() => { const t=document.getElementById('jfPaste'); t.value=${JSON.stringify(JOB_B)}; t.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('jfAddPaste').click(); })()`);
    await sleep(2600);
    weak = await page.evaluate(`(() => { const s = window.EPJobFit.analysis(); return s && s.a ? s.a.reqs.filter(r => r.status !== 'strong').length : -1; })()`);
  }
  add('current job has non-strong requirements', weak > 0, { weak });

  // 1. dashboard says they are auto-added
  const dash = await page.evaluate(`(() => {
    const t = document.getElementById('jfResult').textContent || '';
    return { saysAuto: /not strong.+added automatically|added automatically to the AI tailoring prompt/i.test(t), count: (t.match(/(\\d+) requirements? are not strong/) || [])[1] || '' };
  })()`);
  add('dashboard notes automatic inclusion', dash.saysAuto, dash);

  // 2. AI tailoring prompt includes them with missing terms
  const prompt = await page.evaluate(`(async () => {
    window.__clip = '';
    try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__clip = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {}
    const b = document.querySelector('[data-jf-act="prompt"]'); if (b) b.click();
    await new Promise(r => setTimeout(r, 600));
    return window.__clip || '';
  })()`);
  add('AI tailoring prompt lists weak requirements', /GAPS AND PARTIAL MATCHES/.test(prompt) && /- \[(partial|gap)\]/.test(prompt), { chars: prompt.length, hasMissing: /missing terms:/.test(prompt) });
  add('AI tailoring prompt carries missing terms', /missing terms:/.test(prompt), { head: (prompt.match(/GAPS AND PARTIAL[\s\S]{0,240}/) || [''])[0] });

  // 3. work-sample spec + build prompt
  await page.evaluate(`document.getElementById('viewWorkSample').click()`);
  await sleep(2600);
  const ws = await page.evaluate(`(() => ({
    spec: (document.getElementById('wsSpec').textContent || ''),
    prompt: (document.getElementById('wsPrompt').textContent || ''),
  }))()`);
  add('work-sample spec has the weak-requirements block', /Requirements that are not yet strong/.test(ws.spec), { head: (ws.spec.match(/.{0,60}Requirements that are not yet strong.{0,120}/) || [''])[0] });
  add('work-sample build prompt instructs to address them', /1b\. Requirements that are not yet strong/.test(ws.prompt) && /Never invent experience/.test(ws.prompt), { chars: ws.prompt.length });

  // 4. application pack (report) includes them
  await page.evaluate(`document.getElementById('viewJobFit').click()`);
  await sleep(1500);
  await page.evaluate(`(() => { const b = document.querySelector('[data-jf-act="pack"]'); if (b) b.click(); })()`);
  await sleep(2500);
  const files = fs.readdirSync(DL).filter((f) => /\.html?$/i.test(f));
  let pack = '';
  if (files.length) pack = fs.readFileSync(path.join(DL, files[0]), 'utf8');
  add('application pack includes the weak-requirements section', /2b · Requirements that are not yet strong/.test(pack), { file: files[0] || '', bytes: pack.length });

  add('no console errors', page.allErrors().length === 0, { errors: page.allErrors().map((e) => String(e.text).slice(0, 120)) });
} catch (e) {
  add('fatal', false, { error: e.message });
} finally {
  await browser.close();
  const s = { total: checks.length, passed: checks.filter((c) => c.p).length, failed: checks.filter((c) => !c.p) };
  fs.writeFileSync(path.resolve('reports/verify5.json'), JSON.stringify({ checks, summary: s }, null, 2));
  console.log(JSON.stringify(s));
}
