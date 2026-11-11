// qa/verify9.mjs — cost logic (project-specific defaults) + "how this number is computed" popups.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const JOB_B = 'Director of Stewardship Reporting\nCascade Health Network — Office of Philanthropy, Boston, MA\n\nAbout the role\nCascade Health Network seeks a Director of Stewardship Reporting to lead donor reporting, gift agreement compliance and restricted fund stewardship across the system.\n\nResponsibilities\n- Lead the stewardship reporting program for 40,000+ donors and 1,200 endowed funds\n- Own gift agreement compliance, restricted fund reconciliation and Raiser\u2019s Edge data quality\n- Build dashboards used by the Chief Philanthropy Officer\n- Manage five reporting analysts\n\nQualifications\n- 10+ years in advancement services or gift accounting\n- Expert in Raiser\u2019s Edge, SQL, Tableau\n- Bachelor\u2019s degree required';
const checks = [];
const add = (n, p, i) => { checks.push({ n, p: !!p, i }); console.log(`${p ? 'PASS' : 'FAIL'} ${n} :: ${JSON.stringify(i).slice(0, 300)}`); };
const num = (t) => Number(String(t || '').replace(/[^0-9.]/g, '')) || 0;

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const openProgram = async () => {
  await page.evaluate(`(() => { const t=[...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].find(x=>/SMARTER program/i.test(x.textContent||'')); if (t) t.click(); })()`);
  await sleep(1400);
};
const tiles = async () => page.evaluate(`(() => {
  const out = {};
  for (const b of document.querySelectorAll('.sm-big button[data-sm-why]')) {
    out[b.getAttribute('data-sm-why')] = b.textContent.replace(/how\\?/i, '').trim();
  }
  return out;
})()`);
const dialog = async () => page.evaluate(`(() => {
  const d = document.getElementById('jfDialog');
  return { open: d ? d.open : false, kicker: (document.getElementById('jfDlgKicker')||{}).textContent || '', title: (document.getElementById('jfDlgTitle')||{}).textContent || '', body: ((document.getElementById('jfDlgBody')||{}).textContent || '').slice(0, 700) };
})()`);
const closeDialog = async () => { await page.evaluate(`(() => { const c=document.getElementById('jfDlgClose'); if (c) c.click(); })()`); await sleep(350); };

try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });
  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(900);
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2400);
  await openProgram();

  const tA = await tiles();
  const weeks = num(tA.duration);
  add('headline tiles are clickable', Object.keys(tA).length >= 6, { tiles: Object.keys(tA) });

  // cost tile → formula popup
  await page.evaluate(`document.querySelector('.sm-big button[data-sm-why="cost"]').click()`);
  await sleep(700);
  const dCost = await dialog();
  add('investment tile explains its formula', /how this number is computed/i.test(dCost.kicker) && /Estimated investment/i.test(dCost.title) && /Formula:/.test(dCost.body) && /40 h/.test(dCost.body) && /Tools & licences/.test(dCost.body), { title: dCost.title, head: dCost.body.slice(0, 180) });
  await closeDialog();

  // duration + ontime + roi + kpis + risks popups
  const wanted = { duration: /Planned duration/i, ontime: /Chance of finishing/i, roi: /3-year ROI/i, kpis: /KPIs with targets/i, risks: /Risks owned/i };
  for (const [key, re] of Object.entries(wanted)) {
    await page.evaluate(`document.querySelector('.sm-big button[data-sm-why="${key}"]').click()`);
    await sleep(600);
    const d = await dialog();
    add(key + ' tile explains itself', d.open && re.test(d.title) && d.body.length > 120, { title: d.title });
    await closeDialog();
  }

  // the displayed investment must equal weeks × 40 × FTE × rate + tools using the A-tab inputs
  await page.evaluate(`(() => { const b=document.querySelector('[data-sm-stage="a"]'); if (b) b.click(); })()`);
  await sleep(900);
  const inputs = await page.evaluate(`(() => {
    const g = (k) => { const el = document.querySelector('[data-sm-num="' + k + '"]'); return el ? Number(el.value) : null; };
    return { fte: g('fte'), rate: g('rate'), tools: g('tools') };
  })()`);
  const tA2 = await tiles();
  const shown = num(tA2.cost);
  const expected = Math.round(weeks * 40 * inputs.fte * inputs.rate + inputs.tools);
  add('displayed investment matches its own formula', Math.abs(shown - expected) <= 1, { weeks, fte: inputs.fte, rate: inputs.rate, tools: inputs.tools, shown, expected });
  add('cost is no longer the old flat ~$130K default for every project', !(Math.abs(shown - 130200) <= 600), { shown, expected });

  // a different programme type must produce a different investment
  await page.evaluate(`document.getElementById('viewJobFit').click()`);
  await sleep(900);
  await page.evaluate(`(() => { const t=document.getElementById('jfPaste'); t.value=${JSON.stringify(JOB_B)}; t.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('jfAddPaste').click(); })()`);
  await sleep(2500);
  await page.evaluate(`(() => { const c=[...document.querySelectorAll('#jfJobs .jf-job')].find(x=>/Stewardship/i.test(x.textContent||'')); if (c && !c.classList.contains('sel')) c.click(); })()`);
  await sleep(1800);
  await openProgram();
  const tB = await tiles();
  const shownB = num(tB.cost);
  add('a different programme gets a different investment', shownB > 0 && shownB !== shown, { analytics: shown, advancement: shownB, analyticsWeeks: weeks, advancementWeeks: num(tB.duration) });
  await page.evaluate(`document.querySelector('.sm-big button[data-sm-why="cost"]').click()`);
  await sleep(700);
  const dB = await dialog();
  add('second programme’s popup names its own inputs', /Formula:/.test(dB.body) && dB.body.includes(String(shownB).slice(0, 2)), { head: dB.body.slice(0, 160) });
  add('no console errors', page.allErrors().length === 0, { errors: page.allErrors().map((e) => String(e.text).slice(0, 120)) });
} catch (e) {
  add('fatal', false, { error: e.message });
} finally {
  await browser.close();
  const s = { total: checks.length, passed: checks.filter((c) => c.p).length, failed: checks.filter((c) => !c.p) };
  fs.writeFileSync(path.resolve('reports/verify9.json'), JSON.stringify({ checks, summary: s }, null, 2));
  console.log(JSON.stringify(s));
}

