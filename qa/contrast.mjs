// qa/contrast.mjs — runtime WCAG AA contrast audit over every workspace.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = process.argv[2] || path.resolve('AI_Pilot.html');
const url = pathToFileURL(FILE).href;
const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const out = { views: [] };
try {
  await page.init();
  await page.navigate(url, { settleMs: 1200 });
  const views = await page.evaluate(`[...document.querySelectorAll('.view-toggle')].map(b => b.id)`);
  const audit = `(() => {
    function parse(c) { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
      const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    function lum(c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); }
    function blend(fg, bg) { const a = fg.a; return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }; }
    function bgOf(el) {
      let node = el;
      while (node && node.nodeType === 1) {
        const s = getComputedStyle(node);
        if (s.backgroundImage && s.backgroundImage !== 'none') return { gradient: true };
        const c = parse(s.backgroundColor);
        if (c && c.a > 0) { if (c.a === 1) return c; node = node.parentElement; continue; }
        node = node.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    }
    function ratio(a, b) { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
    const fails = []; let tested = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'RECT', 'CIRCLE', 'LINE', 'TEXT', 'G', 'POLYLINE'].includes(el.tagName)) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      if (el.closest('.mini-arrow,.flow-arrow,.career-flow .arrow,.svg-wrap,svg')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
      if (!own) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) continue;
      const fg0 = parse(s.color); if (!fg0) continue;
      const bg = bgOf(el);
      if (bg.gradient) continue;
      const fg = fg0.a < 1 ? blend(fg0, bg) : fg0;
      const size = parseFloat(s.fontSize); const weight = +s.fontWeight || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const r = ratio(fg, bg);
      tested += 1;
      if (r + 0.005 < (large ? 3 : 4.5)) {
        fails.push({ sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : ''), text: own.slice(0, 40), color: s.color, bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')', ratio: +r.toFixed(2), size, weight });
      }
    }
    return { tested, fails };
  })()`;
  for (const id of views) {
    await page.evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
    await sleep(600);
    const r = await page.evaluate(audit);
    out.views.push({ id, tested: r.tested, failures: r.fails.length, worst: r.fails.sort((a, b) => a.ratio - b.ratio).slice(0, 6) });
  }
} catch (e) {
  out.fatal = e.stack || e.message;
} finally {
  try { await browser.close(); } catch {}
  const totalFail = out.views.reduce((a, v) => a + v.failures, 0);
  const totalTested = out.views.reduce((a, v) => a + v.tested, 0);
  fs.writeFileSync(path.resolve('reports/contrast.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ totalTested, totalFail, byView: out.views.map((v) => `${v.id}:${v.failures}/${v.tested}`), worst: out.views.flatMap((v) => v.worst).sort((a, b) => a.ratio - b.ratio).slice(0, 12), fatal: out.fatal }, null, 2));
}
