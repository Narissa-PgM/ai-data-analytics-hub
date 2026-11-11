// qa/probe-profile.mjs — reproduce the saved-profile + sample job flow; check the SMARTER résumé.
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
    // user's own saved profile first, then a job
    const step1 = await page.evaluate(`(() => {
      const b = document.getElementById('jfUseProfile'); if (!b) return 'no button';
      b.click(); return 'clicked';
    })()`);
    await sleep(1200);
    const step2 = await page.evaluate(`(() => {
      const b = document.getElementById('jfSample'); if (!b) return 'no sample';
      b.click(); return 'clicked';
    })()`);
    await sleep(2200);
    // open Résumé tab
    await page.evaluate(`(() => {
      const t = [...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].find(x => /r[eé]sum[eé]/i.test(x.textContent||''));
      if (t) t.click();
    })()`);
    await sleep(1500);
    const info = await page.evaluate(`(() => {
      const root = document.getElementById('jfResult');
      const txt = root.textContent || '';
      const card = [...root.querySelectorAll('.jf-card')].find(c => /SMARTER format/i.test((c.querySelector('h3')||{}).textContent||''));
      const btns = card ? [...card.querySelectorAll('button,a')].map(b => (b.textContent||'').trim()).filter(Boolean) : [];
      return {
        smarterCard: !!card,
        cardChars: card ? (card.textContent||'').length : 0,
        hasSpecifically: /Specifically/.test(txt), hasMeasurably: /Measurably/.test(txt),
        hasAchievably: /Achievably/.test(txt), hasRelevantly: /Relevantly/.test(txt), hasTimebound: /Time-bound/.test(txt),
        cardButtons: btns,
        checks: root.querySelectorAll('.jf-check').length,
        checkStatuses: [...root.querySelectorAll('.jf-check')].map(c => c.getAttribute('data-jf-check') + ':' + c.getAttribute('data-s')),
        firstResumeHasSMARTER: (() => { const r = root.querySelector('article.rz, .rz, [class*=resume]'); return r ? /SMARTER|Specifically/.test(r.textContent||'') : null; })(),
        bodyHasSmarterWord: /SMARTER/.test(txt),
      };
    })()`);
    out[file] = { step1, step2, info, errors: page.allErrors().map((e) => String(e.text).slice(0, 160)) };
    page.close?.();
  }
} catch (e) { out.fatal = e.stack || e.message; }
finally {
  try { await browser.close(); } catch {}
  fs.writeFileSync(path.resolve('reports/probe-profile.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2).slice(0, 5000));
}
