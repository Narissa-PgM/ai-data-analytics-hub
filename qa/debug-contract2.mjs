// qa/debug-contract2.mjs — is the contract saved into the brief, and does the build use it?
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve('AI_Pilot.html');
const TEXT = ['Contract parties: CREO ↔ Dean\'s Office', 'Contract period: 12 months', 'Baseline rule: baseline within 60 days', '',
  'Priority 1 — Integrate research & library services', 'Source: HKS 2036', '',
  'Specific\tPublish a single service catalog.', 'Measurable\tCatalog published.', 'Achievable\tDraft by day 90.', 'Relevant\tEnables the ecosystem.', 'Time-bound\tLive month 6.', 'Evaluated\t90-day review.', 'Revised\tRe-scope if behind.',
  '', 'Priority 2 — Reduce time-to-research', 'Source: posting', '',
  'Specific\tMap three paths.', 'Measurable\t25% cycle time reduction.', 'Achievable\tBaseline in 60 days.', 'Relevant\tCore mandate.', 'Time-bound\tAll by month 12.', 'Evaluated\tQuarterly.', 'Revised\tRe-target.',
  '', 'Governance of the contract itself', 'Checkpoints: Day 60, Day 90, Month 6, Month 12.'].join('\n');

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const out = {};
try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });
  out.exports = await page.evaluate(`Object.keys(window.EPWorkSampleStudio || {})`);
  await page.evaluate(`document.getElementById('viewWorkSample').click()`);
  await sleep(1200);
  await page.evaluate(`(() => { const d=document.querySelector('[data-apx-det="ws"]'); if (d && d.getAttribute('aria-expanded') !== 'true') d.click(); })()`);
  await sleep(500);
  out.elBefore = await page.evaluate(`(() => { const c=document.getElementById('wsContract'); return c ? { found: true, inForm: !!c.closest('#wsForm'), hidden: c.closest('.apx-hid') ? true : false } : { found: false }; })()`);
  await page.evaluate(`(() => { const c=document.getElementById('wsContract'); c.value=${JSON.stringify(TEXT)}; c.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await page.evaluate(`document.getElementById('wsBuild').click()`);
  await sleep(2000);
  out.after = await page.evaluate(`(() => {
    let brief = null; try { brief = JSON.parse(localStorage.getItem('ep_worksample_v1') || 'null'); } catch (e) {}
    return {
      savedContract: brief ? String(brief.contract || '').slice(0, 80) : '(no brief)',
      savedContractLen: brief ? String(brief.contract || '').length : -1,
      status: (document.getElementById('wsStatus').textContent || '').slice(0, 100),
      specHasContract: /SMARTER measurement contract/.test(document.getElementById('wsSpec').textContent || ''),
      score: (window.EPWorkSampleStudio && window.EPWorkSampleStudio.score) ? window.EPWorkSampleStudio.score() : null,
    };
  })()`);
  // force a re-render via the module API and check again
  out.rebuilt = await page.evaluate(`(() => { try { window.EPWorkSampleStudio.build(); } catch (e) { return 'ERR ' + e.message; } return {
    specHasContract: /SMARTER measurement contract/.test(document.getElementById('wsSpec').textContent || ''),
    score: window.EPWorkSampleStudio.score ? window.EPWorkSampleStudio.score() : null,
  }; })()`);
  out.errors = page.allErrors().map((e) => String(e.text).slice(0, 200));
} catch (e) { out.fatal = e.stack || e.message; }
finally {
  await browser.close();
  console.log(JSON.stringify(out, null, 2).slice(0, 4000));
}
