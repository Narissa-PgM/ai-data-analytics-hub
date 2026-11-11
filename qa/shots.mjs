// qa/shots.mjs — screenshots of every workspace, desktop + mobile.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = process.argv[2] || path.resolve('AI_Pilot.html');
const DIR = process.argv[3] || path.resolve('reports/shots');
const url = pathToFileURL(FILE).href;
fs.mkdirSync(DIR, { recursive: true });

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
await page.init();
const errors = [];
try {
  await page.navigate(url, { settleMs: 1500 });
  const views = await page.evaluate(`[...document.querySelectorAll('.view-toggle')].map(b => b.id)`);
  await page.setViewport(1440, 900);
  for (const id of views) {
    await page.evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
    await sleep(600);
    await page.evaluate('window.scrollTo(0,0)');
    await sleep(250);
    await page.screenshot(path.join(DIR, `view-${id}-1440.png`));
  }
  // Mobile shots of first three views
  await page.setViewport(390, 844, { mobile: true });
  for (const id of views.slice(0, 3)) {
    await page.evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
    await sleep(600);
    await page.evaluate('window.scrollTo(0,0)');
    await sleep(250);
    await page.screenshot(path.join(DIR, `view-${id}-390.png`));
  }
  await page.clearViewport();
  // Console errors during the whole pass
  console.log(JSON.stringify({ views: views.length, shots: fs.readdirSync(DIR).length, errors: page.allErrors().map(e => String(e.text).slice(0, 200)) }, null, 2));
} finally {
  await browser.close();
}
