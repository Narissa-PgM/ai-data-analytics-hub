// qa/baseline.mjs — runtime baseline audit for AI_Pilot.html
// Dependency-free: reuses qa/cdp.mjs (Node global fetch + WebSocket).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH, CHROME_PATH } from './cdp.mjs';

const FILE = process.argv[2] || path.resolve('AI_Pilot.html');
const OUT = process.argv[3] || path.resolve('reports/baseline.json');
const url = pathToFileURL(FILE).href;

const report = { file: FILE, bytes: fs.statSync(FILE).size, startedAt: new Date().toISOString() };

let browser;
async function launch() {
  // Prior QA notes: Chrome aborts in this sandbox; Edge starts fine.
  const candidates = [
    { browserPath: EDGE_PATH, browserName: 'edge' },
    { browserPath: CHROME_PATH, browserName: 'chrome' },
  ];
  let lastErr;
  for (const c of candidates) {
    try {
      const b = await launchBrowser({ ...c, windowSize: '1440,900' });
      report.browser = c.browserName;
      report.browserVersion = b.browserVersion;
      return b;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

const J = (v) => JSON.stringify(v);

try {
  browser = await launch();
  const page = new PageDriver(browser);
  await page.init();

  // ---- Load + timing -------------------------------------------------
  const t0 = Date.now();
  await page.navigate(url, { settleMs: 500 });
  report.loadWallMs = Date.now() - t0;
  await page.waitForFunction('document.readyState === "complete"', { timeout: 30000, label: 'readyState complete' });
  await sleep(1200);
  report.loadMsToComplete = Date.now() - t0;

  report.timing = await page.evaluate(`(() => {
    const t = performance.timing || {};
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const paint = performance.getEntriesByType('paint') || [];
    return {
      domContentLoaded: t.domContentLoadedEventEnd ? t.domContentLoadedEventEnd - t.navigationStart : null,
      loadEvent: t.loadEventEnd ? t.loadEventEnd - t.navigationStart : null,
      domInteractive: t.domInteractive ? t.domInteractive - t.navigationStart : null,
      responseEnd: nav.responseEnd || null,
      firstPaint: (paint.find(p => p.name === 'first-paint') || {}).startTime || null,
      firstContentfulPaint: (paint.find(p => p.name === 'first-contentful-paint') || {}).startTime || null,
      domNodes: document.getElementsByTagName('*').length,
      htmlBytes: document.documentElement.outerHTML.length,
    };
  })()`);

  // ---- Structure -----------------------------------------------------
  report.structure = await page.evaluate(`(() => {
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    const dupes = Object.entries(ids.reduce((a,id)=>{a[id]=(a[id]||0)+1;return a;},{})).filter(([,n])=>n>1);
    const views = [...document.querySelectorAll('.view-toggle')].map(b => ({ id: b.id, label: (b.textContent||'').trim().replace(/\\s+/g,' ') }));
    const panels = [...document.querySelectorAll('[data-view], .view, .panel')].length;
    const sections = [...document.querySelectorAll('section[id]')].map(s => s.id);
    const anchors = [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href'));
    const brokenAnchors = anchors.filter(h => h.length > 1 && !document.getElementById(h.slice(1)));
    const ext = [...document.querySelectorAll('[src],[href]')]
      .map(e => e.getAttribute('src') || e.getAttribute('href'))
      .filter(u => u && /^https?:/i.test(u));
    const scripts = [...document.querySelectorAll('script')].map(s => s.textContent.length);
    const styles = [...document.querySelectorAll('style')].map(s => s.textContent.length);
    return {
      duplicateIds: dupes,
      viewToggleCount: views.length,
      views,
      sectionIds: sections,
      brokenAnchors,
      externalRefs: ext,
      scriptBytes: scripts.reduce((a,b)=>a+b,0),
      styleBytes: styles.reduce((a,b)=>a+b,0),
      dialogs: document.querySelectorAll('dialog').length,
      buttons: document.querySelectorAll('button').length,
      inputs: document.querySelectorAll('input,select,textarea').length,
    };
  })()`);

  // ---- A11y static checks -------------------------------------------
  report.a11y = await page.evaluate(`(() => {
    const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const name = (el) => {
      const al = el.getAttribute('aria-label'); if (al && al.trim()) return al.trim();
      const lb = el.getAttribute('aria-labelledby');
      if (lb) { const t = lb.split(/\\s+/).map(id => (document.getElementById(id)||{}).textContent||'').join(' ').trim(); if (t) return t; }
      const txt = (el.textContent||'').trim(); if (txt) return txt;
      const title = el.getAttribute('title'); if (title && title.trim()) return title.trim();
      if (el.labels && el.labels.length) { const t = [...el.labels].map(l => l.textContent).join(' ').trim(); if (t) return t; }
      return '';
    };
    const btnNoName = [...document.querySelectorAll('button, [role="button"]')].filter(b => visible(b) && !name(b))
      .map(b => ({ cls: b.className, id: b.id, html: b.outerHTML.slice(0, 140) }));
    const inputNoName = [...document.querySelectorAll('input,select,textarea')].filter(el => {
      if (el.type === 'hidden') return false;
      if (!visible(el)) return false;
      return !name(el) && !el.getAttribute('placeholder');
    }).map(el => ({ tag: el.tagName, type: el.type, id: el.id, html: el.outerHTML.slice(0, 140) }));
    const imgsNoAlt = [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt'))
      .map(i => i.outerHTML.slice(0, 120));
    const svgNoLabel = [...document.querySelectorAll('svg')].filter(s => {
      if (s.getAttribute('aria-hidden') === 'true') return false;
      if (s.getAttribute('role') === 'img') return false;
      return !s.querySelector('title');
    }).length;
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => +h.tagName[1]);
    const skips = headings.filter((l, i) => i > 0 && l - headings[i-1] > 1).length;
    return {
      buttonWithoutName: btnNoName, inputWithoutName: inputNoName, imgWithoutAlt: imgsNoAlt,
      svgWithoutLabel: svgNoLabel, headingJumps: skips, h1Count: headings.filter(l=>l===1).length,
      lang: document.documentElement.lang, title: document.title,
    };
  })()`);

  // ---- Per-view switching + console errors ---------------------------
  const viewIds = report.structure.views.map((v) => v.id).filter(Boolean);
  report.views = [];
  const panelSelectors = await page.evaluate(`(() => [...document.querySelectorAll('.view-toggle')].map(b => b.id))()`);

  for (const id of viewIds) {
    const mark = page.mark();
    const res = await page.evalSafe(`(() => {
      const b = document.getElementById(${J(id)});
      if (!b) return { ok: false, reason: 'missing button' };
      b.click();
      return { ok: true, ariaCurrent: b.getAttribute('aria-current'), pressed: b.getAttribute('aria-pressed') };
    })()`);
    await sleep(450);
    const state = await page.evaluate(`(() => {
      const main = document.getElementById('main') || document.body;
      const vis = [...main.children].filter(el => { const r = el.getBoundingClientRect(); return r.height > 5 && getComputedStyle(el).display !== 'none'; });
      return {
        visibleTopLevel: vis.length,
        headingText: (main.querySelector('h1, h2, .view-title, [role="heading"]') || {}).textContent || '',
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    })()`);
    const errs = page.errorsSince(mark).map((e) => ({ type: e.type, text: String(e.text).slice(0, 300) }));
    report.views.push({ id, click: res.ok ? true : res, state, errors: errs });
  }

  report.consoleErrorsTotal = page.allErrors().map((e) => ({ type: e.type, text: String(e.text).slice(0, 400) }));

  // ---- Responsive overflow ------------------------------------------
  report.responsive = [];
  for (const [w, h] of [[1920, 1080], [1440, 900], [1024, 768], [768, 900], [390, 844], [360, 780]]) {
    await page.setViewport(w, h, { mobile: w < 700 });
    await sleep(400);
    const m = await page.evaluate(`(() => {
      const de = document.documentElement;
      const over = [...document.querySelectorAll('body *')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > de.clientWidth + 2 || r.left < -2);
      }).slice(0, 12).map(el => ({ tag: el.tagName, id: el.id, cls: String(el.className).slice(0, 60), right: Math.round(el.getBoundingClientRect().right) }));
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, overflowCount: over.length, sample: over };
    })()`);
    report.responsive.push({ w, h, ...m });
  }
  await page.clearViewport();

  // ---- Print ---------------------------------------------------------
  await page.setViewport(1440, 900);
  await sleep(300);
  try {
    const pdf = await browser.conn.send('Page.printToPDF', {
      printBackground: true, paperWidth: 8.5, paperHeight: 11,
      marginTop: 0.4, marginBottom: 0.4, marginLeft: 0.4, marginRight: 0.4,
    }, browser.sessionId);
    const buf = Buffer.from(pdf.data, 'base64');
    fs.writeFileSync(path.resolve('reports/baseline-print.pdf'), buf);
    report.print = { bytes: buf.length, pages: (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length };
  } catch (e) { report.print = { error: e.message }; }

  report.finishedAt = new Date().toISOString();
} catch (e) {
  report.fatal = e.stack || e.message;
} finally {
  try { await browser?.close(); } catch { /* ignore */ }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  const summary = {
    bytes: report.bytes,
    browser: report.browser,
    loadMsToComplete: report.loadMsToComplete,
    timing: report.timing,
    dupes: report.structure?.duplicateIds?.length,
    views: report.structure?.viewToggleCount,
    brokenAnchors: report.structure?.brokenAnchors?.length,
    externalRefs: report.structure?.externalRefs?.length,
    btnNoName: report.a11y?.buttonWithoutName?.length,
    inputNoName: report.a11y?.inputWithoutName?.length,
    svgNoLabel: report.a11y?.svgWithoutLabel,
    consoleErrors: report.consoleErrorsTotal?.length,
    viewErrors: report.views?.filter((v) => v.errors?.length).length,
    overflow: report.responsive?.map((r) => `${r.w}:${r.scrollWidth}/${r.clientWidth} over=${r.overflowCount}`),
    print: report.print,
    fatal: report.fatal,
  };
  console.log(JSON.stringify(summary, null, 2));
}
