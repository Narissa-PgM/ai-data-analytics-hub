// qa/verify3.mjs — format-check fixes + SMARTER résumé integrity + 2-page check.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const DL = path.resolve('reports/downloads');
fs.rmSync(DL, { recursive: true, force: true });
fs.mkdirSync(DL, { recursive: true });

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const checks = [];
const add = (n, p, i) => { checks.push({ n, p: !!p, i }); console.log(`${p ? 'PASS' : 'FAIL'} ${n} :: ${JSON.stringify(i).slice(0, 240)}`); };
try {
  await page.init();
  await browser.conn.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });

  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(1000);
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2000);
  await page.evaluate(`(() => { const t=[...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].find(x=>/r[eé]sum[eé]/i.test(x.textContent||'')); if (t) t.click(); })()`);
  await sleep(1500);

  const ui = await page.evaluate(`(() => {
    const root = document.getElementById('jfResult');
    const txt = root.textContent || '';
    const smarterCard = [...root.querySelectorAll('.jf-card')].find(c => /SMARTER format/i.test((c.querySelector('h3')||{}).textContent||''));
    const rz = root.querySelector('.rz');
    const checks = [...root.querySelectorAll('.jf-check')].map(c => ({ id: c.getAttribute('data-jf-check'), s: c.getAttribute('data-s'), fixed: c.getAttribute('data-fixed') === '1', em: (c.querySelector('em')||{}).textContent || '' }));
    return {
      smarterCard: !!smarterCard, smarterChars: rz ? (rz.textContent||'').length : 0,
      headings: rz ? [...rz.querySelectorAll('h4')].map(h => h.textContent.trim()) : [],
      hasProfileHeading: rz ? /PROFILE · EXECUTIVE LEADERSHIP STATEMENT/.test(rz.textContent || '') : false,
      hasSkillsHeading: rz ? /SKILLS & CAPABILITIES/.test(rz.textContent || '') : false,
      hasSMARTERWords: rz ? /Specifically/.test(rz.textContent||'') && /Time-bound/.test(rz.textContent||'') : false,
      checks, fixedCount: checks.filter(c => c.fixed).length,
      panel: (() => { const p = root.querySelector('.jf-fixpanel'); return p ? p.textContent.replace(/\\s+/g,' ').trim().slice(0, 320) : ''; })(),
      kpi: (() => { const k = [...root.querySelectorAll('.jf-kpi')].find(x => /ATS readiness/.test(x.textContent||'')); return k ? k.textContent.replace(/\\s+/g,' ').trim() : ''; })(),
    };
  })()`);
  add('SMARTER résumé card renders', ui.smarterCard && ui.smarterChars > 2000, { chars: ui.smarterChars });
  add('SMARTER statement kept', ui.hasSMARTERWords, { headings: ui.headings });
  add('résumé has PROFILE heading', ui.hasProfileHeading, ui.headings);
  add('résumé has SKILLS heading', ui.hasSkillsHeading, ui.headings);
  add('format checks show fixed rows', ui.fixedCount > 0, { fixedCount: ui.fixedCount, checks: ui.checks.map(c => `${c.id}:${c.s}${c.fixed ? '→fixed' : ''}`) });
  add('“what was fixed” panel shown', /Fixed for you|Nothing could be fixed|All format checks pass|Résumé length is unchanged/.test(ui.panel), { panel: ui.panel });
  add('panel states length unchanged', /length is unchanged|two pages/i.test(ui.panel), { panel: ui.panel });

  // Fit dashboard KPI should count fixed rows too
  const kpi = await page.evaluate(`(() => {
    const t=[...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].find(x=>/fit dashboard/i.test(x.textContent||''));
    if (t) t.click();
    const k=[...document.querySelectorAll('#jfResult .jf-kpi')].find(x=>/ATS readiness/.test(x.textContent||''));
    return k ? k.textContent.replace(/\s+/g,' ').trim() : '';
  })()`);
  add('ATS readiness KPI counts fixed rows', /\d\/8/.test(kpi) && /fixed by your tailored/.test(kpi), { kpi });
  // back to the résumé tab, then download the printable HTML
  await page.evaluate(`(() => { const t=[...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].find(x=>/r[eé]sum[eé]/i.test(x.textContent||'')); if (t) t.click(); })()`);
  await sleep(1200);
  // Download the printable HTML and check content + print page count
  await page.evaluate(`(() => { const b=[...document.querySelectorAll('[data-jf-act="resumehtml"]')][0]; if (b) b.click(); })()`);
  await sleep(2500);
  const files = fs.readdirSync(DL).filter((f) => /\.html?$/i.test(f));
  let dlInfo = { files };
  if (files.length) {
    const p = path.join(DL, files[0]);
    const html = fs.readFileSync(p, 'utf8');
    dlInfo = { file: files[0], bytes: html.length, profile: /PROFILE · EXECUTIVE LEADERSHIP STATEMENT/.test(html), skills: /SKILLS & CAPABILITIES/.test(html), smarter: /Specifically/.test(html), pages: null };
    // print the downloaded document and count pages
    const p2 = new PageDriver(browser);
    await p2.init();
    await p2.navigate(pathToFileURL(p).href, { settleMs: 800 });
    const pdf = await browser.conn.send('Page.printToPDF', { printBackground: true, paperWidth: 8.5, paperHeight: 11 }, browser.sessionId);
    const buf = Buffer.from(pdf.data, 'base64');
    dlInfo.pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    fs.writeFileSync(path.resolve('reports/resume-print.pdf'), buf);
    p2.close?.();
  }
  add('downloaded résumé keeps SMARTER format', dlInfo.profile && dlInfo.skills && dlInfo.smarter, dlInfo);
  add('downloaded résumé prints on 2 pages', dlInfo.pages === 2, { pages: dlInfo.pages });
} catch (e) {
  add('fatal', false, { error: e.message });
} finally {
  try { await browser.close(); } catch {}
  const s = { total: checks.length, passed: checks.filter((c) => c.p).length, failed: checks.filter((c) => !c.p) };
  fs.writeFileSync(path.resolve('reports/verify3.json'), JSON.stringify({ checks, summary: s, ui: undefined }, null, 2));
  console.log(JSON.stringify(s));
}


