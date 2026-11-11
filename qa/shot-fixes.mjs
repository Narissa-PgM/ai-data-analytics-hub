// qa/shot-fixes.mjs — screenshot of the SMARTER résumé card + fixed format checks.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const DIR = path.resolve('reports/shots-v3');
fs.mkdirSync(DIR, { recursive: true });
const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,1000' });
const page = new PageDriver(browser);
try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });
  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(1000);
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2200);
  // dashboard: ATS KPI + fixed checks
  await page.evaluate(`window.scrollTo(0,0)`);
  await sleep(300);
  const dashCard = await page.evaluate(`(() => { const c=[...document.querySelectorAll('#jfResult .jf-card')].find(x=>/ATS & format checks/.test(x.textContent||'')); if(c) c.scrollIntoView({block:'center'}); return !!c; })()`);
  await sleep(500);
  await page.screenshot(path.join(DIR, 'format-checks-fixed.png'));
  // résumé tab: SMARTER card top
  await page.evaluate(`(() => { const t=[...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].find(x=>/r[eé]sum[eé]/i.test(x.textContent||'')); if (t) t.click(); })()`);
  await sleep(1200);
  await page.evaluate(`(() => { const card=[...document.querySelectorAll('#jfResult .jf-card')].find(c=>/SMARTER format/i.test((c.querySelector('h3')||{}).textContent||'')); if(card) card.scrollIntoView({block:'start'}); })()`);
  await sleep(500);
  await page.screenshot(path.join(DIR, 'smarter-resume.png'));
  console.log(JSON.stringify({ dashCard, shots: fs.readdirSync(DIR) }));
} finally { await browser.close(); }

