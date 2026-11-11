// qa/verify2.mjs — prove each change landed: chart semantics, keyboard, modal trap,
// focus ring, contrast tokens, mobile compaction, print colours, lazy library.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = process.argv[2] || path.resolve('AI_Pilot.html');
const url = pathToFileURL(FILE).href;
const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const checks = [];
const add = (name, pass, info) => { checks.push({ name, pass: !!pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name} :: ${JSON.stringify(info).slice(0, 220)}`); };

try {
  await page.init();
  await page.navigate(url, { settleMs: 1500 });

  // 1. Lazy library: cards absent at load, present after opening.
  const before = await page.evaluate(`document.querySelectorAll('#catalog .command-card').length`);
  await page.evaluate(`document.getElementById('viewLibrary').click()`);
  await sleep(500);
  const after = await page.evaluate(`document.querySelectorAll('#catalog .command-card').length`);
  add('lazy library builds only when opened', before === 0 && after === 111, { before, after });

  // 2. Focus ring + input border tokens are present and computed.
  const tokens = await page.evaluate(`(() => {
    let ringRule = false;
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      for (const r of rules) {
        if (!r.style) continue;
        const sel = r.selectorText || '';
        if (/focus-visible/.test(sel) && /11, 93, 107|0b5d6b/i.test(r.style.outline || '')) ringRule = true;
      }
    }
    const input = document.querySelector('#catalog input, input[type=search], input[type=text]');
    return { ringRule, border: input ? getComputedStyle(input).borderColor : null };
  })()`);
  add('focus ring rule installed', tokens.ringRule, tokens);
  add('input boundary >= 3:1 colour applied', /127, 145, 156|7f919c/i.test(String(tokens.border)), { border: tokens.border });

  // 3. Micro-text computed colour.
  const micro = await page.evaluate(`(() => {
    const el = document.querySelector('.tip, .legend, .jf-kpi small, .recipes p');
    return el ? getComputedStyle(el).color : null;
  })()`);
  add('micro text uses #56697a', /86, 105, 122/.test(String(micro)), { color: micro });

  // 4. Chart semantics — historical mode must not draw a forecast line.
  await page.evaluate(`document.getElementById('viewAnalyzer').click()`);
  await sleep(300);
  await page.evaluate(`(() => {
    document.getElementById('projectTitle').value = 'Synthetic QA Platform';
    document.getElementById('forecastSelect').value = 'historical';
    document.getElementById('yearStart').value = '2020';
    document.getElementById('yearEnd').value = '2024';
    document.getElementById('runAnalyzer').click();
  })()`);
  await sleep(700);
  const hist = await page.evaluate(`(() => {
    const tile = document.querySelector('#outDemo .viz-tile.wide');
    const lines = [...tile.querySelectorAll('polyline')].map(p => ({ pts: (p.getAttribute('points')||'').trim().split(/\\s+/).filter(Boolean).length, dash: p.getAttribute('stroke-dasharray') }));
    const legend = (tile.querySelector('.legend')||{}).textContent||'';
    const caption = (tile.querySelector('p')||{}).textContent||'';
    return { lines, legend, caption };
  })()`);
  const dashedEmpty = hist.lines.filter((l) => l.dash).every((l) => l.pts === 0);
  add('historical mode: no synthetic-forecast segment', dashedEmpty && !/forecast/i.test(hist.legend), hist);
  add('chart caption follows the chosen horizon', /2020–2024/.test(hist.caption), { caption: hist.caption });

  // 5. Forecast mode still draws the dashed segment with a correct legend.
  await page.evaluate(`(() => {
    document.getElementById('forecastSelect').value = 'forecast';
    document.getElementById('yearStart').value = '2020';
    document.getElementById('yearEnd').value = '2030';
    document.getElementById('runAnalyzer').click();
  })()`);
  await sleep(700);
  const fc = await page.evaluate(`(() => {
    const tile = document.querySelector('#outDemo .viz-tile.wide');
    const lines = [...tile.querySelectorAll('polyline')].map(p => ({ pts: (p.getAttribute('points')||'').trim().split(/\\s+/).filter(Boolean).length, dash: p.getAttribute('stroke-dasharray') }));
    return { lines, legend: (tile.querySelector('.legend')||{}).textContent||'' };
  })()`);
  add('forecast mode: dashed segment + forecast legend', fc.lines.some((l) => l.dash && l.pts > 1) && /forecast/i.test(fc.legend), fc);

  // 6. Keyboard activation for [data-ri] nodes.
  const key = await page.evaluate(`(() => {
    document.getElementById('viewJobFit').click();
    const host = document.getElementById('jobFitPanel');
    const box = document.createElement('div');
    box.setAttribute('data-ri', 'qa-test');
    box.tabIndex = 0;
    box.textContent = 'qa';
    host.appendChild(box);
    let clicked = 0;
    host.addEventListener('click', (e) => { if (e.target === box) clicked += 1; }, true);
    box.focus();
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const enter = clicked;
    box.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    box.remove();
    return { enter, space: clicked };
  })()`);
  add('[data-ri] nodes activate on Enter and Space', key.enter >= 1 && key.space >= 2, key);

  // 7. Modal focus containment for #edModal.
  const modal = await page.evaluate(`(() => {
    const m = document.getElementById('edModal');
    m.classList.add('open');
    const f = [...m.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')].filter(x => x.getClientRects().length);
    f[f.length-1].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const afterTab = document.activeElement === f[0];
    f[0].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    const afterShift = document.activeElement === f[f.length-1];
    m.classList.remove('open');
    return { count: f.length, afterTab, afterShift };
  })()`);
  add('modal Tab containment works (#edModal)', modal.afterTab && modal.afterShift, modal);

  // 7b. Keyboard search shortcut opens the library and focuses the field.
  const hotkey = await page.evaluate(`(() => {
    document.getElementById('viewJobFit').click();
    const wasHidden = document.getElementById('libraryPanel').hidden;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    return {
      wasHidden,
      libraryVisible: !document.getElementById('libraryPanel').hidden,
      focused: document.activeElement === document.getElementById('search'),
      cards: document.querySelectorAll('#catalog .command-card').length,
    };
  })()`);
  add('Ctrl+K opens the library and focuses search', hotkey.wasHidden && hotkey.libraryVisible && hotkey.focused && hotkey.cards > 100, hotkey);

  // 8. Mobile compaction: 3-across stepper, static toolbar, 44 px targets.
  await page.setViewport(390, 844, { mobile: true });
  await sleep(500);
  const stepFit = await page.evaluate(`(() => {
    const steps = document.getElementById('jfSteps');
    const rows = new Set([...steps.querySelectorAll('.jf-step')].map(el => Math.round(el.getBoundingClientRect().top))).size;
    return { stepsHeight: Math.round(steps.getBoundingClientRect().height), rows };
  })()`);
  await page.evaluate(`document.getElementById('viewLibrary').click()`);
  await sleep(500);
  await page.evaluate(`(() => { const s=document.getElementById('search'); s.value='study'; s.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await sleep(400);
  const mobile = await page.evaluate(`(() => {
    const toolbar = document.querySelector('.toolbar');
    const clear = document.querySelector('.clear-search');
    const icon = document.querySelector('.icon-btn');
    return {
      toolbarPosition: toolbar ? getComputedStyle(toolbar).position : null,
      clearSize: clear ? [Math.round(clear.getBoundingClientRect().width), Math.round(clear.getBoundingClientRect().height)] : null,
      iconSize: icon ? [Math.round(icon.getBoundingClientRect().width), Math.round(icon.getBoundingClientRect().height)] : null,
      pageScrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  })()`);
  add('Job Fit stepper is 3-across on a phone', stepFit.rows === 1 && stepFit.stepsHeight < 250, stepFit);
  add('phone toolbar is not sticky', mobile.toolbarPosition === 'static', { position: mobile.toolbarPosition });
  add('phone tap targets reach 44 px', mobile.clearSize && mobile.clearSize[1] >= 44, { clear: mobile.clearSize, icon: mobile.iconSize });
  add('no horizontal page overflow at 390', mobile.pageScrollWidth <= mobile.clientWidth, mobile);

  // 9. Print colours for the pilot hero.
  await page.clearViewport();
  await page.conn.send('Emulation.setEmulatedMedia', { media: 'print' }, page.sessionId);
  await sleep(300);
  const printStyle = await page.evaluate(`(() => {
    const hero = document.querySelector('#pilotPanel .xp-hero');
    if (!hero) return null;
    const s = getComputedStyle(hero);
    return { color: s.color, background: s.backgroundColor };
  })()`);
  await page.conn.send('Emulation.setEmulatedMedia', { media: '' }, page.sessionId);
  add('pilot hero prints dark-on-white', printStyle && /17, 17, 17/.test(printStyle.color) && /255, 255, 255/.test(printStyle.background), printStyle);

  // 10. Skip-link target focusable.
  const skip = await page.evaluate(`(() => { const m = document.getElementById('main'); m.focus(); return document.activeElement === m && m.tabIndex === -1; })()`);
  add('main is a focusable skip target', skip, {});
} catch (e) {
  add('fatal', false, { error: e.message });
} finally {
  try { await browser.close(); } catch {}
  const summary = { total: checks.length, passed: checks.filter((c) => c.pass).length, failed: checks.filter((c) => !c.pass) };
  fs.writeFileSync(path.resolve('reports/verify2.json'), JSON.stringify({ checks, summary }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}
