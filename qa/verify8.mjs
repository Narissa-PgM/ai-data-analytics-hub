// qa/verify8.mjs — the structured research-document JSON shape (mission by level, plan, evidence register).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const DOC = {
  research_metadata: { title: 'Mission, Values & Current Strategic Plan', research_date: '2026-11-10', research_scope: 'Harvard University to CREO unit scale' },
  job: { title: 'Chief Research Enablement Officer', abbreviation: 'CREO', reference: '003413SR', institution: 'Harvard University', school: 'Harvard Kennedy School', url: 'https://careers.harvard.edu/job/creo' },
  mission_values_by_level: [
    { level: 1, organization: 'Harvard University', mission: { exact_quote: 'Harvard’s mission of excellence in teaching, learning, and research' }, values: [{ name: 'Respect', summary: 'Respect the rights, differences, and dignity of others.' }, { name: 'Integrity', exact_quote: 'Demonstrate honesty and integrity in all dealings' }] },
    { level: 2, organization: 'Harvard Kennedy School', mission: { exact_quote_segments: ['Harvard Kennedy School trains exceptional public leaders, generates cutting-edge research', 'to make the world more safe, free, just, and sustainably prosperous for all.'] }, published_principles: ['Respect', 'Intellectual rigor'] },
    { level: 3, organization: 'HKS Library & Research Services', mission: { exact_quote: 'Library & Research Services (LRS) advances the HKS mission by serving the research, data, and curricular needs of our community.' } },
    { level: 4, organization: 'Chief Research Enablement Officer', mandate_type: 'Published position responsibilities', mission_interpretation: 'Coordinate institutional research enablement capabilities to deliver effective, reliable, compliant, and researcher-centered services.' },
  ],
  current_strategic_plan: { name: 'HKS 2036: Leadership for a New Era', publication_date: '2026-06-03', planning_horizon: '2026-2036', official_pdf: 'https://www.hks.harvard.edu/sites/default/files/about_us/HKS_2036.pdf', goals: [{ id: 1, name: 'Research and Scholarly Excellence' }, { id: 6, name: 'Technology for the Public Good' }] },
  strategic_research_priorities: [{ priority: 'Research Infrastructure', direction: 'Strengthen systems, computing, data, and institutional support for research.' }],
  related_current_initiatives: [{ name: 'Harvard Impact Labs', purpose_summary: 'Expand research and development connections between scholars and public-sector partners.' }],
  university_research_partners: [{ organization: 'Harvard Library', source_url: 'https://library.harvard.edu/about' }],
  proposed_creo_operating_priorities: { priorities: [{ id: 'P1', name: 'Researcher Time', objective: 'Reduce administrative friction so researchers can devote more time to scholarship.' }] },
  evidence_register: [{ id: 'S01', title: 'Harvard Community Values', url: 'https://ccl.harvard.edu/about/community-values' }, { id: 'S03', title: 'HKS 2036', url: 'https://www.hks.harvard.edu/sites/default/files/about_us/HKS_2036.pdf' }],
  limitations: { creo_specific_approved_strategic_plan_found: false },
  executive_conclusion: { recommended_application_theme: 'Connect strategy, people, analytics, governance, and systems to enable scholarship.' },
};

const checks = [];
const add = (n, p, i) => { checks.push({ n, p: !!p, i }); console.log(`${p ? 'PASS' : 'FAIL'} ${n} :: ${JSON.stringify(i).slice(0, 320)}`); };

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });
  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(900);
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2400);
  await page.evaluate(`(() => { const t=[...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].find(x=>/SMARTER program/i.test(x.textContent||'')); if (t) t.click(); })()`);
  await sleep(1200);
  await page.evaluate(`(() => { const b=document.querySelector('[data-sm-act="rjsonshow"]'); const box=document.querySelector('.sm-json'); if (box && box.hidden && b) b.click(); })()`);
  await sleep(500);
  await page.evaluate(`(() => { const ta=document.querySelector('[data-sm-json]'); ta.value=${JSON.stringify(JSON.stringify(DOC))}; const b=document.querySelector('[data-sm-act="rjson"]'); if (b) b.click(); })()`);
  await sleep(2000);

  const r = await page.evaluate(`(() => {
    const job = window.EPJobFit.current().job;
    const R = job.research || {};
    return {
      kicker: (document.getElementById('jfDlgKicker') || {}).textContent || '',
      title: (document.getElementById('jfDlgTitle') || {}).textContent || '',
      mission: (document.querySelector('[data-sm-r="mission"]') || {}).value || '',
      values: (document.querySelector('[data-sm-r="values"]') || {}).value || '',
      initiatives: (document.querySelector('[data-sm-r="initiatives"]') || {}).value || '',
      org: (document.querySelector('[data-sm-r="org"]') || {}).value || '',
      plan: R.plan || '', sources: R.sources || '', motto: R.motto || '', opPrios: R.operatingPriorities || '',
      ref: job.ref || '',
    };
  })()`);
  add('structured research document applies', /research json applied/i.test(r.kicker), { kicker: r.kicker, title: r.title });
  add('mission assembled from all levels', r.mission.includes('Harvard’s mission') && r.mission.includes('Harvard Kennedy School trains') && r.mission.includes('Library & Research Services (LRS)') && r.mission.includes('Coordinate institutional research enablement capabilities'), { head: r.mission.slice(0, 140), full: r.mission });
  add('values assembled from values + principles', /Respect/.test(r.values) && /Integrity/.test(r.values) && /Intellectual rigor/.test(r.values), { head: r.values.replace(/\n/g, ' / ').slice(0, 140) });
  add('strategic plan captured', /HKS 2036/.test(r.plan) && /2026-2036/.test(r.plan), { plan: r.plan });
  add('plan goals + related initiatives captured', /Research and Scholarly Excellence/.test(r.initiatives) && /Harvard Impact Labs/.test(r.initiatives), { head: r.initiatives.replace(/\n/g, ' / ').slice(0, 160) });
  add('evidence register becomes sources', /ccl\.harvard\.edu/.test(r.sources) && /HKS_2036\.pdf/.test(r.sources) && /library\.harvard\.edu/.test(r.sources), { head: r.sources.replace(/\n/g, ' / ').slice(0, 160) });
  add('proposed operating priorities kept separately', /Researcher Time/.test(r.opPrios), { head: r.opPrios.slice(0, 120) });
  add('executive theme captured', /Connect strategy, people/.test(r.motto), { motto: r.motto.slice(0, 100) });
  add('job reference captured from the document', r.ref === '003413SR', { ref: r.ref });
  add('organization resolved', /Harvard Kennedy School/.test(r.org), { org: r.org });

  // the same research should feed the work sample brief
  await page.evaluate(`document.getElementById('viewWorkSample').click()`);
  await sleep(2800);
  const ws = await page.evaluate(`(() => ({
    mission: (document.getElementById('wsMission') || {}).value || '',
    plan: (document.getElementById('wsPlan') || {}).value || '',
  }))()`);
  add('work-sample brief receives mission + plan', /Harvard/.test(ws.mission) && /HKS 2036|Research and Scholarly Excellence/.test(ws.plan), { mission: ws.mission.slice(0, 100), plan: ws.plan.slice(0, 100) });
  add('no console errors', page.allErrors().length === 0, { errors: page.allErrors().map((e) => String(e.text).slice(0, 120)) });
} catch (e) {
  add('fatal', false, { error: e.message });
} finally {
  await browser.close();
  const s = { total: checks.length, passed: checks.filter((c) => c.p).length, failed: checks.filter((c) => !c.p) };
  fs.writeFileSync(path.resolve('reports/verify8.json'), JSON.stringify({ checks, summary: s }, null, 2));
  console.log(JSON.stringify(s));
}


