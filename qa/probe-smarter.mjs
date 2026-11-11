// qa/probe-smarter.mjs — does the SMARTER-format résumé card render? Compare two files.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node probe-smarter.mjs file1 [file2]'); process.exit(1); }
const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const out = {};
try {
  for (const file of files) {
    const page = new PageDriver(browser);
    await page.init();
    await page.navigate(pathToFileURL(path.resolve(file)).href, { settleMs: 1500 });
    await page.evaluate(`document.getElementById('jfSample').click()`);
    await sleep(1800);
    const info = await page.evaluate(`(() => {
      const bodyText = document.body.textContent;
      const tabs = [...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].map(t => (t.textContent||'').trim());
      const cards = [...document.querySelectorAll('#jfResult .jf-card h3')].map(h => h.textContent.trim());
      const checks = [...document.querySelectorAll('#jfResult .jf-check')].map(c => ({
        id: c.getAttribute('data-jf-check'), status: c.getAttribute('data-s'), label: (c.querySelector('strong')||{}).textContent || '',
        detail: (c.querySelector('small')||{}).textContent || '', more: (c.querySelector('em')||{}).textContent || '',
      }));
      const hasSmarter = /SMARTER format/i.test(bodyText);
      const hasEditor = !!document.querySelector('#jfResult .jf-editor');
      return { hasSmarter, cards, checkCount: checks.length, checks, tabs, hasEditor, smarterIdx: bodyText.indexOf('SMARTER format') };
    })()`);
    // click the Résumé tab if the tab list exposes one
    const tabClicked = await page.evaluate(`(() => {
      const t = [...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].find(x => /r[eé]sum[eé]/i.test(x.textContent||''));
      if (!t) return false; t.click(); return true;
    })()`);
    await sleep(1200);
    const afterTab = await page.evaluate(`(() => {
      const bodyText = document.body.textContent;
      const cards = [...document.querySelectorAll('#jfResult .jf-card h3')].map(h => h.textContent.trim());
      const checks = [...document.querySelectorAll('#jfResult .jf-check')].length;
      const smarterCard = [...document.querySelectorAll('#jfResult .jf-card h3')].find(h => /SMARTER format/i.test(h.textContent));
      const resumePreview = document.querySelector('#jfResult .resume-print, #jfResult iframe, #jfResult [class*=resume]');
      return { hasSmarter: /SMARTER format/i.test(bodyText), cards, checks, smarterCard: !!smarterCard,
               resumeNode: resumePreview ? resumePreview.className : null,
               firstCheckText: (document.querySelector('#jfResult .jf-check')||{}).textContent || '' };
    })()`);
    // open the first check popup to see what it recommends
    const popup = await page.evaluate(`(() => {
      const c = document.querySelector('#jfResult .jf-check'); if (!c) return null;
      c.click();
      const d = document.getElementById('jfDialog');
      return d ? { open: d.open, title: (document.getElementById('jfDlgTitle')||{}).textContent || '',
                   body: (document.getElementById('jfDlgBody')||{}).textContent.slice(0, 700) } : { open: false };
    })()`);
    out[file] = { info, tabClicked, afterTab, popup };
    page.close?.();
  }
} catch (e) { out.fatal = e.stack || e.message; }
finally {
  try { await browser.close(); } catch {}
  fs.writeFileSync(path.resolve('reports/probe-smarter.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 6000));
}
