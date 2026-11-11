// qa/verify11.mjs — application kit strip (next-step) + backup/restore.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const checks = [];
const add = (n, p, i) => { checks.push({ n, p: !!p, i }); console.log(`${p ? 'PASS' : 'FAIL'} ${n} :: ${JSON.stringify(i).slice(0, 300)}`); };

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const kit = () => page.evaluate(`(() => {
  const strip = document.querySelector('.jf-kit');
  if (!strip) return null;
  return {
    steps: [...strip.querySelectorAll('.jf-kit-step')].map((b) => ({ label: b.textContent.replace(/[✓•]/g, '').trim(), done: b.classList.contains('done'), tab: b.getAttribute('data-jf-tab'), act: b.getAttribute('data-jf-act') })),
    next: (strip.querySelector('.jf-kit-next') || {}).textContent || '',
  };
})()`);
try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1600 });
  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(900);
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2600);

  const k0 = await kit();
  add('kit strip renders with six steps', !!k0 && k0.steps.length === 6, { steps: k0 && k0.steps.map((s) => s.label) });
  add('kit starts by pointing at the résumé file', !!k0 && /Next: Download the résumé/i.test(k0.next), { next: k0 && k0.next });

  // résumé step jumps to the résumé tab
  await page.evaluate(`document.querySelector('.jf-kit-step[data-jf-tab="resume"]').click()`);
  await sleep(700);
  const tab1 = await page.evaluate(`(() => ({ sel: document.querySelector('#jfTabBody .jf-card h3') ? document.querySelector('#jfTabBody .jf-card h3').textContent : '', active: (document.querySelector('.jf-tab[aria-selected="true"]') || {}).textContent || '' }))()`);
  add('résumé step opens the résumé tab', /Résumé/i.test(tab1.active), tab1);

  // download résumé → step becomes done, next moves to the cover letter
  await page.evaluate(`(() => { const b = document.querySelector('[data-jf-act="resumedocx"]'); if (b) b.click(); })()`);
  await sleep(1400);
  const k1 = await kit();
  add('downloading the résumé marks the step done', !!k1 && k1.steps.find((s) => /Résumé file/.test(s.label)).done === true, { next: k1 && k1.next });
  add('kit advances to the cover letter', !!k1 && /Next: Download the cover letter/i.test(k1.next), { next: k1 && k1.next });

  // cover letter download
  await page.evaluate(`document.querySelector('.jf-kit-step[data-jf-tab="cover"]').click()`);
  await sleep(800);
  await page.evaluate(`(() => { const b = document.querySelector('[data-jf-act="coverdocx"]'); if (b) b.click(); })()`);
  await sleep(1400);
  const k2 = await kit();
  add('downloading the cover letter marks the step done', !!k2 && k2.steps.find((s) => /Cover letter/.test(s.label)).done === true, { next: k2 && k2.next });
  add('kit advances to the work sample', !!k2 && /Build the work sample/i.test(k2.next), { next: k2 && k2.next });

  // work-sample step navigates to the studio
  await page.evaluate(`document.querySelector('.jf-kit-step[data-jf-act="worksample"]').click()`);
  await sleep(1200);
  const inStudio = await page.evaluate(`!document.getElementById('workSamplePanel').hidden`);
  add('work-sample step opens Work Sample Studio', inStudio, {});

  // tracker step completes and the kit says download the pack
  await page.evaluate(`document.getElementById('viewJobFit').click()`);
  await sleep(1000);
  await page.evaluate(`document.querySelector('.jf-kit-step[data-jf-act="track"]').click()`);
  await sleep(1200);
  const k3 = await kit();
  add('saving to the tracker marks that step done', !!k3 && k3.steps.find((s) => /Tracker/.test(s.label)).done === true, { next: k3 && k3.next });
  // download the work sample from the autopilot strip, then every step is done
  await page.evaluate(`(() => { const b = document.querySelector('[data-jf-act="worksampledl"]'); if (b) b.click(); })()`);
  await sleep(1400);
  const k4 = await kit();
  add('work-sample download marks the step done', !!k4 && k4.steps.find((s) => /Work sample/.test(s.label)).done === true, { next: k4 && k4.next });
  add('kit ends by offering the pack', !!k4 && /Download the pack/i.test(k4.next), { next: k4 && k4.next });

  // backup: buttons exist, export contains the app keys, import restores them
  const backupUi = await page.evaluate(`(() => ({ exp: !!document.getElementById('epBackupExport'), imp: !!document.getElementById('epBackupImport'), file: !!document.getElementById('epBackupFile') }))()`);
  add('backup controls exist in the rail', backupUi.exp && backupUi.imp && backupUi.file, backupUi);
  const backup = await page.evaluate(`(() => {
    const txt = window.EPBackup.exportText();
    const o = JSON.parse(txt);
    const hasJobfit = !!(o.keys && o.keys.ep_jobfit_v1);
    const jobfit = localStorage.getItem('ep_jobfit_v1');
    const n = window.EPBackup.importText(JSON.stringify({ keys: { ep_jobfit_v1: '{"items":[],"tab":"fit"}' } }));
    const changed = localStorage.getItem('ep_jobfit_v1') === '{"items":[],"tab":"fit"}';
    localStorage.setItem('ep_jobfit_v1', jobfit);
    return { hasJobfit, keys: Object.keys(o.keys || {}).length, n, changed, restored: localStorage.getItem('ep_jobfit_v1') === jobfit };
  })()`);
  add('backup exports the saved app data', backup.hasJobfit && backup.keys > 0, { keys: backup.keys });
  add('restore writes a backup back into storage', backup.n === 1 && backup.changed && backup.restored, backup);
  add('no console errors', page.allErrors().length === 0, { errors: page.allErrors().map((e) => String(e.text).slice(0, 120)) });
} catch (e) {
  add('fatal', false, { error: e.message });
} finally {
  await browser.close();
  const s = { total: checks.length, passed: checks.filter((c) => c.p).length, failed: checks.filter((c) => !c.p) };
  fs.writeFileSync(path.resolve('reports/verify11.json'), JSON.stringify({ checks, summary: s }, null, 2));
  console.log(JSON.stringify(s));
}

