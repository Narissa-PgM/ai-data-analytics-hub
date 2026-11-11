// qa/debug-rw.mjs — why does the rendered work sample show only the header?
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve('AI_Pilot.html');
const ADV = 'Director of Stewardship Reporting\nCascade Health Network — Office of Philanthropy, Boston, MA\n\nAbout the role\nCascade Health Network seeks a Director of Stewardship Reporting to lead donor reporting, gift agreement compliance and restricted fund stewardship across the system.\n\nResponsibilities\n- Lead the stewardship reporting programme for 40,000+ donors and 1,200 endowed funds\n- Own gift agreement compliance, restricted fund reconciliation and Raiser\u2019s Edge data quality\n- Partner with gift officers on donor impact reports and annual fund reporting\n- Build dashboards used by the Chief Philanthropy Officer\n- Manage five reporting analysts\n\nQualifications\n- 10+ years in advancement services or gift accounting\n- Bachelor\u2019s degree required';

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const out = {};
try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });
  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(900);
  await page.evaluate(`(() => { const t=document.getElementById('jfPaste'); t.value=${JSON.stringify(ADV)}; t.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('jfAddPaste').click(); })()`);
  await sleep(2600);
  out.build = await page.evaluate(`(() => {
    const s = window.EPJobFit.analysis(); const html = window.EPReporting.build(s.a, s.j);
    const D = window.EPReporting.ctx(s.a, s.j);
    return { chars: html.length, adv: D.adv, secs: D.secs.length, duties: D.align.length, title: D.title };
  })()`);
  out.render = await page.evaluate(`(async () => {
    let host = document.getElementById('__probeHost');
    if (!host) { host = document.createElement('div'); host.id='__probeHost'; host.style.cssText='position:absolute;left:-9999px;top:0;width:1200px;height:900px'; document.body.appendChild(host); }
    host.innerHTML='';
    const fr = document.createElement('iframe'); fr.style.cssText='width:1200px;height:900px;border:0'; host.appendChild(fr);
    const errs = [];
    fr.addEventListener('load', () => { try { fr.contentWindow.addEventListener('error', (e) => errs.push(String(e.message))); } catch (e) { errs.push('attach:' + e.message); } });
    fr.srcdoc = ${JSON.stringify('HTML_PLACEHOLDER')};
    // rebuild with real html inside the page context
    return 'skip';
  })()`);
  // simpler: set srcdoc via evaluate with the html passed in
  out.render2 = await page.evaluate(`(async () => {
    const s = window.EPJobFit.analysis(); const html = window.EPReporting.build(s.a, s.j);
    let host = document.getElementById('__probeHost');
    if (!host) { host = document.createElement('div'); host.id='__probeHost'; host.style.cssText='position:absolute;left:-9999px;top:0;width:1200px;height:900px'; document.body.appendChild(host); }
    host.innerHTML='';
    const fr = document.createElement('iframe'); fr.style.cssText='width:1200px;height:900px;border:0'; fr.setAttribute('sandbox','allow-scripts allow-same-origin');
    host.appendChild(fr);
    const errs = [];
    const orig = window.onerror;
    fr.srcdoc = html;
    await new Promise((r) => setTimeout(r, 3500));
    let mainKids = -1, txt = '', bodyLen = -1, title = '';
    try {
      const doc = fr.contentDocument;
      title = doc.title || '';
      const main = doc.getElementById('main');
      mainKids = main ? main.children.length : -1;
      const clone = doc.body.cloneNode(true);
      clone.querySelectorAll('script,style,template,noscript').forEach((n) => n.remove());
      txt = (clone.textContent || '').replace(/\\s+/g,' ');
      bodyLen = txt.length;
    } catch (e) { errs.push('read:' + e.message); }
    host.innerHTML='';
    return { mainKids, bodyLen, title, head: txt.slice(0, 500), hasDonor: /Donor retention|gift officer/.test(txt), errs };
  })()`);
  out.errors = page.allErrors().map((e) => String(e.text).slice(0, 200));
} catch (e) { out.fatal = e.stack || e.message; }
finally {
  await browser.close();
  console.log(JSON.stringify(out, null, 2).slice(0, 5000));
}
