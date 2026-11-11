// qa/probe-tabs.mjs — compare every Job Fit tab between two builds.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const files = process.argv.slice(2);
const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const out = {};
try {
  for (const file of files) {
    const page = new PageDriver(browser);
    await page.init();
    await page.navigate(pathToFileURL(path.resolve(file)).href, { settleMs: 1500 });
    await page.evaluate(`document.getElementById('jfSample').click()`);
    await sleep(1800);
    const tabs = await page.evaluate(`[...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].map(t => (t.textContent||'').trim())`);
    const perTab = [];
    for (let i = 0; i < tabs.length; i += 1) {
      await page.evaluate(`(() => { const t=[...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')][${i}]; if (t) t.click(); })()`);
      await sleep(700);
      const info = await page.evaluate(`(() => {
        const root = document.getElementById('jfResult');
        const cards = [...root.querySelectorAll('.jf-card h3')].map(h => h.textContent.trim());
        return {
          chars: (root.textContent||'').trim().length,
          cards: cards.slice(0, 14),
          smarterTitle: [...root.querySelectorAll('.jf-card h3')].some(h => /SMARTER format/i.test(h.textContent)),
          checks: root.querySelectorAll('.jf-check').length,
          editors: root.querySelectorAll('.jf-editor').length,
          tables: root.querySelectorAll('table').length,
          svgs: root.querySelectorAll('svg').length,
          buttons: root.querySelectorAll('button').length,
        };
      })()`);
      perTab.push({ tab: tabs[i], ...info });
    }
    out[file] = { tabs, perTab, errors: page.allErrors().map((e) => String(e.text).slice(0, 200)) };
    page.close?.();
  }
} catch (e) { out.fatal = e.stack || e.message; }
finally {
  try { await browser.close(); } catch {}
  fs.writeFileSync(path.resolve('reports/probe-tabs.json'), JSON.stringify(out, null, 2));
  for (const [f, v] of Object.entries(out)) {
    if (!v.perTab) { console.log(f, v); continue; }
    console.log('\n=== ' + f + ' ===');
    for (const t of v.perTab) console.log(`${t.tab} | chars=${t.chars} cards=${t.cards.length} smarter=${t.smarterTitle} checks=${t.checks} editors=${t.editors} tables=${t.tables} svgs=${t.svgs}`);
    console.log('errors:', JSON.stringify(v.errors));
  }
}
