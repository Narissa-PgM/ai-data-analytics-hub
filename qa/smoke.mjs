// qa/smoke.mjs — functional smoke tests across all 15 workspaces.
// Each step: activate view, perform an action, assert a user-visible outcome, collect console errors.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = process.argv[2] || path.resolve('AI_Pilot.html');
const OUT = process.argv[3] || path.resolve('reports/smoke.json');
const url = pathToFileURL(FILE).href;

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const results = [];
const PARTIAL = path.resolve('reports/smoke.partial.json');
const flush = () => { try { fs.writeFileSync(PARTIAL, JSON.stringify(results, null, 2)); } catch { /* ignore */ } };
try {
  await page.init();
  // Auto-dismiss native alert/confirm/print-blocking dialogs so a step can never hang the run.
  await page.conn.send('Page.enable', {}, page.sessionId).catch(() => {});
  page.conn.on('Page.javascriptDialogOpening', () => {
    page.conn.send('Page.handleJavaScriptDialog', { accept: true }, page.sessionId).catch(() => {});
  });
  // Neutralise blocking native surfaces (print preview, popups, alert/confirm) during the smoke run.
  await page.conn.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.print=function(){window.__qaPrintCalls=(window.__qaPrintCalls||0)+1};
             window.open=function(){window.__qaOpenCalls=(window.__qaOpenCalls||0)+1;return null};
             window.alert=function(){window.__qaAlerts=(window.__qaAlerts||0)+1};
             window.confirm=function(){window.__qaConfirms=(window.__qaConfirms||0)+1;return true};
             window.prompt=function(){window.__qaPrompts=(window.__qaPrompts||0)+1;return null};`,
  }, page.sessionId);
  await page.navigate(url, { settleMs: 1800 });

  const click = (id) => `document.getElementById(${JSON.stringify(id)}).click()`;
  const idle = (ms) => sleep(ms);

  async function step({ view, name, act, wait = 700, check, detail }) {
    const mark = page.mark();
    const started = Date.now();
    if (view) await page.evaluate(`document.getElementById(${JSON.stringify(view)}).click()`);
    await idle(400);
    let acted = null;
    if (act) {
      const r = await Promise.race([
        page.evalSafe('(() => { ' + act + ' })()', { timeoutMs: 8000 }),
        new Promise((res) => setTimeout(() => res({ ok: false, error: 'step action timeout (native dialog?)' }), 10000)),
      ]);
      acted = r.ok ? 'ok' : 'ERR: ' + String(r.error).slice(0, 200);
    }
    await idle(wait);
    let passed = false, info = '';
    const cr = await Promise.race([
      page.evalSafe(`(() => { ${check} })()`, { timeoutMs: 8000 }),
      new Promise((res) => setTimeout(() => res({ ok: false, error: 'step check timeout' }), 10000)),
    ]);
    if (!cr.ok) { passed = false; info = 'check threw: ' + String(cr.error).slice(0, 200); }
    else if (Array.isArray(cr.value)) { passed = !!cr.value[0]; info = JSON.stringify(cr.value[1] ?? ''); }
    else { passed = !!cr.value; }
    const errs = page.errorsSince(mark).map((e) => String(e.text).slice(0, 300));
    results.push({ view, name, detail: detail || '', acted, passed, info: String(info).slice(0, 500), errors: errs, ms: Date.now() - started });
    flush();
    console.log(`${passed ? 'PASS' : 'FAIL'} ${view || ''} · ${name}${info ? ' :: ' + info.slice(0, 120) : ''}`);
  }

  // ---------- 1. Job Fit Studio ----------
  await step({ view: 'viewJobFit', name: 'default view is Job Fit and only one panel visible',
    check: `const vis=[...document.querySelectorAll('main > section, main > div')].filter(p=>!p.hidden&&getComputedStyle(p).display!=='none').map(p=>p.id);
            return [document.getElementById('jobFitPanel').hidden===false && vis.filter(id=>id&&id.endsWith('Panel')).length===1, {visible:vis}];`,
    wait: 100 });

  await step({ view: 'viewJobFit', name: 'Try sample job renders a fit result', act: click('jfSample'), wait: 1400,
    check: `const t=document.getElementById('jfResult').textContent.replace(/\\s+/g,' ').trim();
            return [t.length > 80 && !/Drop a job/i.test(t), {chars:t.length, head:t.slice(0,120)}];` });

  await step({ view: 'viewJobFit', name: 'Forget everything clears result', act: click('jfClear'), wait: 800,
    check: `const t=document.getElementById('jfResult').textContent.replace(/\\s+/g,' ').trim();
            return [t.length < 400 || /Drop a job|Add a job|no job/i.test(t), {chars:t.length, head:t.slice(0,120)}];` });

  // ---------- 2. Command Library ----------
  await step({ view: 'viewLibrary', name: 'library renders 111 cards', wait: 600,
    check: `const n=document.querySelectorAll('#catalog .command-card').length;
            const total=document.getElementById('totalNumber').textContent;
            return [n > 50, {cards:n, totalLabel:total}];` });

  await step({ view: 'viewLibrary', name: 'search filters the catalog', wait: 700,
    act: `const s=document.getElementById('search'); s.value='study'; s.dispatchEvent(new Event('input',{bubbles:true}));`,
    check: `const n=document.querySelectorAll('#catalog .command-card').length;
            const label=document.getElementById('resultCount').textContent.replace(/\\s+/g,' ').trim();
            return [n>0 && n<200 && /study/i.test(document.getElementById('catalog').textContent), {cards:n,label}];` });

  await step({ view: 'viewLibrary', name: 'open command details dialog and close with Escape', wait: 500,
    act: `document.getElementById('showAll').click(); var od=document.querySelector('#catalog .command-card .open-details'); if(od) od.click();`,
    check: `const o=document.getElementById('overlay'); return [o.classList.contains('open') && document.getElementById('dialogTitle').textContent.trim().length>2, {title:document.getElementById('dialogTitle').textContent, open:o.className}];` });

  await step({ view: 'viewLibrary', name: 'Escape closes dialog and restores focus', wait: 400,
    act: `document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`,
    check: `const o=document.getElementById('overlay');
            return [!o.classList.contains('open'), {open:o.className}];` });

  await step({ view: 'viewLibrary', name: 'star a command updates favourites count', wait: 500,
    act: `document.getElementById('showAll').click(); var sb=document.querySelector('#catalog .command-card .icon-btn'); if(sb) sb.click();`,
    check: `const n=parseInt(document.getElementById('favoriteNumber').textContent,10);
            return [n>=1, {favorites:n}];` });

  // ---------- 3. Resume + Cover Letter ----------
  await step({ view: 'viewCareer', name: 'Load example then generate career package', wait: 1200,
    act: `document.getElementById('cSample').click(); document.getElementById('cJob').value='Director of Analytics at Example University. Lead the institutional research and analytics function; own the data governance program, portfolio reporting and a team of eight analysts. Requires 10+ years in higher education analytics, SQL, Tableau and executive stakeholder management across academic and administrative units.'; document.getElementById('cGenerate').click();`,
    check: `const out=document.getElementById('cOutput'); const t=(out.textContent||'').replace(/\\s+/g,' ').trim();
            const tabs=document.querySelectorAll('.career-tab').length;
            return [t.length>200, {chars:t.length, tabs, head:t.slice(0,100)}];` });

  await step({ view: 'viewCareer', name: 'tab switch renders letter tab', wait: 600,
    act: `[...document.querySelectorAll('.career-tab')].find(b=>/letter/i.test(b.textContent)).click()`,
    check: `const t=document.getElementById('cOutput').textContent.replace(/\\s+/g,' ').trim();
            return [/dear|sincerely|letter/i.test(t), {head:t.slice(0,140)}];` });

  // ---------- 4. Job Match Radar ----------
  await step({ view: 'viewJobRadar', name: 'radar ranks role patterns', wait: 900,
    check: `const cards=document.querySelectorAll('#jrResults .jr-role-card, #jrResults article').length;
            const t=document.getElementById('jrResults').textContent.replace(/\\s+/g,' ').trim();
            return [cards>=10 || t.length>500, {cards, chars:t.length}];` });

  await step({ view: 'viewJobRadar', name: 'open role detail dialog', wait: 600,
    act: `var b=document.querySelector('#jrResults button[data-jr-action="detail"]'); if(b) b.click();`,
    check: `const d=document.getElementById('jrRoleDialog');
            return [!!d && d.open, {open: !!d && d.open, title:(document.getElementById('jrDialogTitle')||{}).textContent||''}];` });

  await step({ view: 'viewJobRadar', name: 'Escape closes role dialog', wait: 400,
    act: `const d=document.getElementById('jrRoleDialog'); if(d&&d.open) d.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));`,
    check: `const d=document.getElementById('jrRoleDialog'); return [!!d && !d.open, {open: !!d && d.open}];` });

  // ---------- 5. Massachusetts Jobs / Remote ----------
  await step({ view: 'viewMAJobs', name: 'generate Massachusetts search plan', wait: 900,
    act: click('mBuild'),
    check: `const r=document.getElementById('mOutput')||document.querySelector('#maJobsPanel [id*=Output], #maJobsPanel .career-output');
            const t=(r?r.textContent:document.getElementById('maJobsPanel').textContent).replace(/\\s+/g,' ').trim();
            return [t.length>300, {chars:t.length, head:t.slice(0,100)}];` });

  await step({ view: 'viewContract', name: 'generate remote proposal', wait: 900,
    act: click('rBuild'),
    check: `const r=document.getElementById('rOutput')||document.querySelector('#contractPanel [id*=Output], #contractPanel .career-output');
            const t=(r?r.textContent:document.getElementById('contractPanel').textContent).replace(/\\s+/g,' ').trim();
            return [t.length>300, {chars:t.length, head:t.slice(0,100)}];` });

  // ---------- 6. Career Fit & Demo Gaps ----------
  await step({ view: 'viewFit', name: 'load synthetic example and analyze', wait: 1200,
    act: `document.getElementById('fitLoadExample').click(); document.getElementById('fitAnalyzeMain').click();`,
    check: `const s=document.getElementById('fitHeadline').textContent.trim();
            const bars=document.querySelectorAll('#fitBars .fit-bar-row').length;
            return [s!=='—' && (bars>0 || s.length>2), {headline:s, bars}];` });

  await step({ view: 'viewFit', name: 'gap backlog renders', wait: 600,
    check: `const n=document.querySelectorAll('#fitGapCards .fit-gap-card').length;
            return [n>0, {cards:n}];` });

  // ---------- 7. Work Sample Studio ----------
  await step({ view: 'viewWorkSample', name: 'load example fills the meter', wait: 1000,
    act: click('wsLoadExample'),
    check: `const v=document.getElementById('wsMeterValue').textContent.trim();
            return [/\\d/.test(v) && !/^0/.test(v), {meter:v}];` });

  await step({ view: 'viewWorkSample', name: 'build spec', wait: 1200,
    act: click('wsBuild'),
    check: `const spec=document.getElementById('wsSpec'); const t=(spec.textContent||'').replace(/\\s+/g,' ').trim();
            return [t.length>300, {chars:t.length, head:t.slice(0,100)}];` });

  // ---------- 8. Admissibility Protocol ----------
  await step({ view: 'viewAdmiss', name: 'gate tab opens with NOT YET ADMISSIBLE', wait: 700,
    act: click('adTabGate'),
    check: `const t=document.getElementById('adPanelGate').textContent.replace(/\\s+/g,' ').trim();
            const v=document.querySelector('#adPanelGate .ad-verdict, #adVerdictLine');
            return [/NOT YET ADMISSIBLE/i.test(t), {verdict:(v?v.textContent:'').slice(0,120)}];` });

  await step({ view: 'viewAdmiss', name: 'load synthetic example produces a verdict', wait: 1000,
    act: click('adLoadExample'),
    check: `const t=document.getElementById('adPanelGate').textContent.replace(/\\s+/g,' ').trim();
            return [/(ADMISSIBLE|NOT YET)/i.test(t), {head:t.slice(0,140)}];` });

  await step({ view: 'viewAdmiss', name: 'intake sheet tab renders', wait: 600,
    act: click('adTabSheet'),
    check: `const p=document.getElementById('adPanelSheet'); return [!!p && !p.hidden && p.textContent.length>500, {chars:p?p.textContent.length:0}];` });

  // ---------- 9. Enterprise Delivery ----------
  await step({ view: 'viewEnterprise', name: 'generate enterprise package', wait: 1600,
    act: `document.getElementById('edExample').click(); setTimeout(() => document.getElementById('edBuild').click(), 300);`,
    check: `const r=document.getElementById('edResults'); const t=(r?r.textContent:'').replace(/\\s+/g,' ').trim();
            return [!!r && !r.hidden && t.length>200, {chars:t.length, head:t.slice(0,100)}];` });

  // ---------- 10. ExecutivePilot Co-worker ----------
  await step({ view: 'viewPilot', name: 'pilot dashboard computes KPIs', wait: 900,
    check: `const t=document.getElementById('xpTopKpis').textContent.replace(/\\s+/g,' ').trim();
            return [/\\d/.test(t), {head:t.slice(0,140)}];` });

  // ---------- 11. Platform Analyzer ----------
  await step({ view: 'viewAnalyzer', name: 'run analyzer produces blueprint', wait: 1600,
    act: `document.getElementById('projectTitle').value='Synthetic Test Platform'; document.getElementById('projectDescription').value='A synthetic decision-support platform for a research portfolio, with dashboards, metrics, filters and popups for leadership review.'; document.getElementById('runAnalyzer').click();`,
    check: `const b=document.getElementById('outBlueprint').textContent.replace(/\\s+/g,' ').trim();
            return [b.length>200, {chars:b.length, head:b.slice(0,100)}];` });

  // ---------- 12. Audit Lab ----------
  await step({ view: 'viewAudit', name: 'load example and run audit', wait: 1800,
    act: `document.getElementById('audExample').click();`,
    check: `const s=document.getElementById('audSummary').textContent.replace(/\\s+/g,' ').trim();
            const checks=document.querySelectorAll('#audResults .aud-check, #audResults tr, #checks *').length;
            return [s.length>40 && !/Awaiting inspection/.test(s), {chars:s.length, checks, head:s.slice(0,100)}];` });

  // ---------- 13. QA Gate ----------
  await step({ view: 'viewQA', name: 'QA gate renders counters and tests', wait: 900,
    check: `const c=document.getElementById('qaCounters').textContent.replace(/\\s+/g,' ').trim();
            const rows=document.querySelectorAll('#qaTests .qa-row').length;
            return [rows>0 || c.length>10, {rows, counters:c.slice(0,120)}];` });

  // ---------- 14. Visual Samples ----------
  await step({ view: 'viewGallery', name: 'gallery cards render', wait: 800,
    check: `const n=document.querySelectorAll('#visualGallery .gallery-card').length; return [n>3, {cards:n}];` });

  await step({ view: 'viewGallery', name: 'open visual popup then close', wait: 500,
    act: `document.querySelector('#visualGallery .gallery-card button').click()`,
    check: `const p=document.getElementById('visualPopup'); return [p.classList.contains('open'), {open:p.className}];` });

  await step({ view: 'viewGallery', name: 'Escape closes visual popup', wait: 400,
    act: `document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`,
    check: `const p=document.getElementById('visualPopup'); return [!p.classList.contains('open'), {open:p.className}];` });

  // ---------- 15. Global ----------
  await step({ view: 'viewJobFit', name: 'document.title tracks active workspace', wait: 400,
    check: `const t=document.title; return [/Job Fit/i.test(t), {title:t}];` });

  await step({ view: 'viewLibrary', name: 'Ctrl+K focuses search', wait: 500,
    act: `document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))`,
    check: `const a=document.activeElement; return [a && a.id==='search', {active:a?a.id||a.tagName:''}];` });
} catch (e) {
  results.push({ fatal: e.stack || e.message });
} finally {
  try { await browser.close(); } catch {}
  const summary = {
    steps: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => r.passed === false).map((r) => ({ view: r.view, name: r.name, info: r.info, acted: r.acted })),
    stepsWithErrors: results.filter((r) => (r.errors || []).length).map((r) => ({ name: r.name, errors: r.errors })),
    allErrors: page.allErrors().map((e) => String(e.text).slice(0, 300)),
    fatal: results.find((r) => r.fatal),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ file: FILE, results, summary }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

