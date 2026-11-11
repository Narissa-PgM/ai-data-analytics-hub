// qa/shot-kit.mjs — screenshots of the application-kit strip and the backup controls.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve('AI_Pilot.html');
const DIR = path.resolve('reports/shots-v6');
fs.mkdirSync(DIR, { recursive: true });
const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,950' });
const page = new PageDriver(browser);
try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1600 });
  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(900);
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2800);
  await page.evaluate(`(() => { const k=document.querySelector('.jf-kit'); if (k) k.scrollIntoView({block:'center'}); })()`);
  await sleep(500);
  await page.screenshot(path.join(DIR, 'kit-desktop.png'));
  await page.setViewport(390, 900, { mobile: true });
  await sleep(700);
  await page.evaluate(`(() => { const k=document.querySelector('.jf-kit'); if (k) k.scrollIntoView({block:'center'}); })()`);
  await sleep(400);
  await page.screenshot(path.join(DIR, 'kit-mobile.png'));
  await page.clearViewport();
  console.log(JSON.stringify({ shots: fs.readdirSync(DIR) }));
} finally { await browser.close(); }

