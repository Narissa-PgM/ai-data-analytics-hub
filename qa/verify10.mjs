// qa/verify10.mjs — work-sample format/domain: a research role must not get the donor-reporting template.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const CREO = [
  'Chief Research Enablement Officer (CREO) REF: 003413SR',
  'Harvard Kennedy School — Cambridge, Massachusetts',
  '',
  'About the role',
  'Harvard Kennedy School seeks a Chief Research Enablement Officer to lead research enablement across the school. The role coordinates research administration, research computing, research data services and library services, and supports the advancement of research excellence and the professional development of research staff.',
  '',
  'Responsibilities',
  '- Lead integrated research services across research administration, research computing, data services and the library',
  '- Own research integrity, compliance intake, sponsored research operations and research data governance',
  '- Partner with the Office of the Vice Provost for Research and the Office for Sponsored Programs',
  '- Build a governed shared data warehouse service and standardize data use agreement review',
  '- Support the stewardship of research resources and the school strategic plan',
  '- Manage a research support workforce and professional development programme',
  '',
  'Qualifications',
  '- 10+ years in research administration or research services in higher education',
  '- Experience with research computing, sponsored research compliance and data governance',
  '- Bachelor\u2019s degree required; advanced degree preferred',
].join('\n');
const ADV = [
  'Director of Stewardship Reporting',
  'Cascade Health Network — Office of Philanthropy, Boston, MA',
  '',
  'About the role',
  'Cascade Health Network seeks a Director of Stewardship Reporting to lead donor reporting, gift agreement compliance and restricted fund stewardship across the system.',
  '',
  'Responsibilities',
  '- Lead the stewardship reporting programme for 40,000+ donors and 1,200 endowed funds',
  '- Own gift agreement compliance, restricted fund reconciliation and Raiser\u2019s Edge data quality',
  '- Partner with gift officers on donor impact reports, annual fund reporting and donor communications',
  '- Build dashboards used by the Chief Philanthropy Officer and the board',
  '- Manage five reporting analysts and oversee fundraising campaign reporting',
  '',
  'Qualifications',
  '- 10+ years in advancement services, gift accounting or donor relations',
  '- Expert in Raiser\u2019s Edge, SQL and Tableau; CASE and IRS substantiation knowledge',
  '- Bachelor\u2019s degree required',
].join('\n');

const checks = [];
const add = (n, p, i) => { checks.push({ n, p: !!p, i }); console.log(`${p ? 'PASS' : 'FAIL'} ${n} :: ${JSON.stringify(i).slice(0, 300)}`); };

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const addJob = async (text) => {
  await page.evaluate(`document.getElementById('viewJobFit').click()`);
  await sleep(600);
  await page.evaluate(`(() => { const t=document.getElementById('jfPaste'); t.value=${JSON.stringify(text)}; t.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('jfAddPaste').click(); })()`);
  await sleep(2600);
};
const probe = async () => page.evaluate(`(() => {
  const s = window.EPJobFit.analysis(); if (!s) return { err: 'no analysis' };
  const a = s.a, j = s.j;
  const html = window.EPProposal.build(a, j);
  const D = window.EPReporting.ctx(a, j);
  return {
    title: j.title, org: j.org, adv: window.EPReporting.detectAdv(j), domain: window.EPReporting.getDomain(j),
    format: window.EPReporting.getFormat(j), reporting: window.EPReporting.isReporting(j),
    ctxAdv: D.adv, chars: html.length,
    donor: /Donor retention|gift officer|Campaign progress dashboard|Daily gift report/.test(html),
    smarter: /SMARTER/.test(html), reportingTitle: /Reporting work sample/.test(html), creo: /Chief Research Enablement Officer/.test(html),
  };
})()`);

try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1600 });
  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(1000);

  // --- CREO: research role → SMARTER format, no donor template ---
  await addJob(CREO);
  const creo = await probe();
  add('CREO is not classified as a reporting role', creo.reporting === false, { reporting: creo.reporting, format: creo.format });
  add('CREO work sample uses the SMARTER format', creo.format === 'smarter' && creo.smarter && !creo.reportingTitle, { format: creo.format, smarter: creo.smarter, reportingTitle: creo.reportingTitle });
  add('CREO work sample contains no donor/gift template', creo.donor === false, { donor: creo.donor });
  add('CREO work sample keeps the CREO job', creo.creo === true, { title: creo.title, org: creo.org });
  add('CREO sample dataset detected as general', creo.adv === false && creo.domain === false && creo.ctxAdv === false, { adv: creo.adv, domain: creo.domain, ctxAdv: creo.ctxAdv });

  // --- advancement job → reporting format with donor dataset ---
  await addJob(ADV);
  const adv = await probe();
  add('advancement role stays a reporting role', adv.reporting === true && adv.format === 'reporting', { reporting: adv.reporting, format: adv.format });
  add('advancement work sample keeps the donor/gift dataset', adv.donor === true && adv.ctxAdv === true, { donor: adv.donor, ctxAdv: adv.ctxAdv });

  // --- manual override of the sample dataset ---
  const over = await page.evaluate(`(() => {
    const s = window.EPJobFit.analysis(); const j = s.j;
    window.EPReporting.setDomain(j, 'adv'); const a1 = window.EPReporting.ctx(s.a, j).adv;
    window.EPReporting.setDomain(j, 'general'); const a2 = window.EPReporting.ctx(s.a, j).adv;
    window.EPReporting.setDomain(j, 'adv'); const a3 = window.EPReporting.ctx(s.a, j).adv;
    return { a1, a2, a3 };
  })()`);
  add('dataset override flips donors on/off per job', over.a1 === true && over.a2 === false && over.a3 === true, over);

  // --- choosing the reporting format for the research role warns and offers a one-click switch ---
  // select the CREO job in Job Fit, then open the Role work sample tab
  await page.evaluate(`document.getElementById('viewJobFit').click()`);
  await sleep(700);
  await page.evaluate(`(() => { const c=[...document.querySelectorAll('#jfJobs .jf-job')].find(x=>/Chief Research Enablement/i.test(x.textContent||'')); if (c) c.click(); })()`);
  await sleep(1800);
  await page.evaluate(`document.getElementById('viewWorkSample').click()`);
  await sleep(1800);
  const ui = await page.evaluate(`(() => {
    const t = document.getElementById('wsTabRole'); if (t) t.click();
    return new Promise((res) => setTimeout(() => {
      const box = document.getElementById('wsRoleBody');
      const rep = box ? box.querySelector('[data-rw="fmt"][data-v="reporting"]') : null;
      if (rep) rep.click();
      setTimeout(() => {
        const b2 = document.getElementById('wsRoleBody');
        const heads = b2 ? /Heads-up/.test(b2.textContent || '') : false;
        const btn = b2 ? b2.querySelector('[data-rw="fmt"][data-v="smarter"]') : null;
        if (btn && heads) btn.click();
        setTimeout(() => res({ heads, hadButton: !!btn, format: window.EPReporting.getFormat(window.EPJobFit.analysis().j) }), 700);
      }, 900);
    }, 700));
  })()`);
  add('forced reporting shows a heads-up with a one-click switch', ui.heads && ui.hadButton, ui);
  add('the one-click switch saves the SMARTER format', ui.format === 'smarter', { format: ui.format });
  add('no console errors', page.allErrors().length === 0, { errors: page.allErrors().map((e) => String(e.text).slice(0, 120)) });
} catch (e) {
  add('fatal', false, { error: e.message });
} finally {
  await browser.close();
  const s = { total: checks.length, passed: checks.filter((c) => c.p).length, failed: checks.filter((c) => !c.p) };
  fs.writeFileSync(path.resolve('reports/verify10.json'), JSON.stringify({ checks, summary: s }, null, 2));
  console.log(JSON.stringify(s));
}

