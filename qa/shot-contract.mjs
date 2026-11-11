// qa/shot-contract.mjs — screenshot of the one-block contract in the spec tab.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve('AI_Pilot.html');
const DIR = path.resolve('reports/shots-v4');
fs.mkdirSync(DIR, { recursive: true });
const TEXT = ['Contract parties: CREO ↔ Dean\'s Office / Research Dean (sponsor)', 'Contract period: 12 months from start date, 90-day and 6-month checkpoints', 'Baseline rule: every metric needs a baseline within the first 60 days.', '',
  'Priority 1 — Integrate research & library services into one ecosystem', 'Source: HKS 2036 "Investing in Our Strong Foundation"', '',
  'Specific\tPublish a single service catalog covering research computing, data services and library liaison; one intake point per service.', 'Measurable\tCatalog published; ≥90% of services with a named owner and SLA; faculty awareness ≥70%.', 'Achievable\tCatalog draft by day 90, live by month 6.', 'Relevant\tEnables the "efficient research ecosystem" language in the posting.', 'Time-bound\tDraft day 90; live month 6; awareness survey month 9.', 'Evaluated\t90-day, 6-month and 9-month reviews.', 'Revised\tIf awareness <50% at month 9, re-scope outreach and extend one quarter with sponsor approval.', '',
  'Priority 2 — Reduce faculty time-to-research', 'Source: posting — streamline research compliance and resource access.', '',
  'Specific\tMap the three most common research starts; remove or parallelize the top friction steps.', 'Measurable\tMedian cycle time −25% per path; faculty satisfaction ≥4.0/5.0.', 'Achievable\tBaseline in 60 days; two redesign sprints in months 3–9.', 'Relevant\tCore enablement mandate.', 'Time-bound\tBaseline day 60; all three paths by month 12.', 'Evaluated\tQuarterly cycle-time dashboard with the Research Dean.', 'Revised\tIf externally constrained, re-target to steps within HKS control.', '',
  'Priority 3 — Research computing, data warehouse & governance', 'Source: posting — FERPA/HIPAA/FISMA, DUAs, shared warehouse.', '',
  'Specific\tGoverned shared warehouse with access tiers; compliance control matrix; standardize DUA review.', 'Measurable\t100% of in-scope systems covered; 100% of new DUAs reviewed within 10 days; zero material findings.', 'Achievable\tLeverage library and central IT.', 'Relevant\tExplicit in posting.', 'Time-bound\tMatrix month 6; warehouse live month 9.', 'Evaluated\tMonth 6 compliance review; annual audit.', 'Revised\tIf dependencies slip, re-sequence launch and hold the matrix.', '',
  'Governance of the contract itself', 'Checkpoints: Day 60 (baselines locked), Day 90, Month 6, Month 12.', 'Dashboard: one page, six priorities, RAG status, monthly with the Research Dean.', 'Change control: any target change needs a written revision note, the new target and sponsor sign-off.', 'Non-negotiables: compliance matrix and RIO protocol — floor requirements.'].join('\n');

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,1000' });
const page = new PageDriver(browser);
try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });
  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(800);
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2200);
  await page.evaluate(`document.getElementById('viewWorkSample').click()`);
  await sleep(1400);
  await page.evaluate(`(() => { const d=document.querySelector('[data-apx-det="ws"]'); if (d && d.getAttribute('aria-expanded') !== 'true') d.click(); })()`);
  await sleep(600);
  await page.evaluate(`(() => { const c=document.getElementById('wsContract'); c.value=${JSON.stringify(TEXT)}; c.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await page.evaluate(`document.getElementById('wsBuild').click()`);
  await sleep(2200);
  // scroll to the contract block in the spec
  await page.evaluate(`(() => { const h=[...document.querySelectorAll('#wsSpec h3')].find(x=>/SMARTER measurement contract/i.test(x.textContent||'')); if (h) h.scrollIntoView({block:'start'}); })()`);
  await sleep(500);
  await page.screenshot(path.join(DIR, 'contract-block.png'));
  // also capture the test in the brief form
  const info = await page.evaluate(`(() => ({ hasBlock: /SMARTER measurement contract — one block, 3 priorities/.test(document.getElementById('wsSpec').textContent||''), promptHas: /ONE block, 3 priorities/.test(document.getElementById('wsPrompt').textContent||'') }))()`);
  console.log(JSON.stringify({ ...info, shots: fs.readdirSync(DIR) }));
} finally { await browser.close(); }
