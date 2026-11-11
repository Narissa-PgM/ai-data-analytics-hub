// qa/shot-cost.mjs — screenshot the "how this number is computed" popup for estimated investment.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve('AI_Pilot.html');
const DIR = path.resolve('reports/shots-v5');
fs.mkdirSync(DIR, { recursive: true });
const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,950' });
const page = new PageDriver(browser);
try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });
  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(900);
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2400);
  await page.evaluate(`(() => { const t=[...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].find(x=>/SMARTER program/i.test(x.textContent||'')); if (t) t.click(); })()`);
  await sleep(1600);
  await page.evaluate(`(() => { const b=document.querySelector('.sm-big button[data-sm-why="cost"]'); if (b) b.click(); })()`);
  await sleep(900);
  await page.screenshot(path.join(DIR, 'cost-formula-popup.png'));
  const info = await page.evaluate(`(() => ({ open: document.getElementById('jfDialog').open, tiles: [...document.querySelectorAll('.sm-big button[data-sm-why]')].length }))()`);
  console.log(JSON.stringify({ ...info, shots: fs.readdirSync(DIR) }));
} finally { await browser.close(); }
