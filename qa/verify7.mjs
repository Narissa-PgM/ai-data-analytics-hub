// qa/verify7.mjs — JSON paste robustness with the formats AI output actually uses.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const NL = '{"organization":"NL Org","mission":{"text":"Line one' + '\n' + 'Line two mission.","url":""}}';
const payloads = [
  ['raw newlines inside a string', NL, /line two mission/i],
  ['line and block comments', '{ // a note from the AI\n "organization":"Comment Org", /* block */ "mission":{"text":"Comment mission.","url":""} }', /comment mission/i],
  ['single-quoted strings', "{'organization':'Single Org','mission':{'text':'Single-quote mission.','url':''}}", /single-quote mission/i],
  ['unquoted keys', '{organization:"Bare Org",mission:{text:"Bare-key mission.",url:""}}', /bare-key mission/i],
  ['top-level array', '[{"organization":"Array Org","mission":{"text":"Array mission.","url":""}},{"organization":"Second"}]', /array mission/i],
  ['Python literals (True/False/None)', '{"organization":"Python Org","mission":{"text":"Python mission.","url":""},"values":[{"name":"Truth","url":""}],"ok":True,"none":None}', /python mission/i],
  ['two objects in prose', 'First {"organization":"One","mission":{"text":"First object mission."}} second {"organization":"Two","mission":{"text":"Second object mission."}}', /object mission/i],
  ['fenced with curly quotes', '```json\n{\u201corganization\u201d:\u201cCurly Org\u201d,\u201cmission\u201d:{\u201ctext\u201d:\u201cCurly mission.\u201d,\u201curl\u201d:\u201chttps://example.edu/m\u201d},\u201cinitiatives\u201d:[]}\n```', /curly mission/i],
];
const checks = [];
const add = (n, p, i) => { checks.push({ n, p: !!p, i }); console.log(`${p ? 'PASS' : 'FAIL'} ${n} :: ${JSON.stringify(i).slice(0, 240)}`); };

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2400);

  for (const [label, payload, expect] of payloads) {
    await page.evaluate(`(() => { const t=[...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].find(x=>/SMARTER program/i.test(x.textContent||'')); if (t) t.click(); })()`);
    await sleep(1000);
    await page.evaluate(`(() => { const b=document.querySelector('[data-sm-act="rjsonshow"]'); const box=document.querySelector('.sm-json'); if (box && box.hidden && b) b.click(); })()`);
    await sleep(400);
    await page.evaluate(`(() => { const ta=document.querySelector('[data-sm-json]'); ta.value=${JSON.stringify(payload)}; const b=document.querySelector('[data-sm-act="rjson"]'); if (b) b.click(); })()`);
    await sleep(1600);
    const r = await page.evaluate(`(() => {
      const d = document.getElementById('jfDialog');
      const title = (document.getElementById('jfDlgTitle') || {}).textContent || '';
      const kicker = (document.getElementById('jfDlgKicker') || {}).textContent || '';
      const body = (document.getElementById('jfDlgBody') || {}).textContent || '';
      const mission = (document.querySelector('[data-sm-r="mission"]') || {}).value || '';
      const status = (document.querySelector('[data-sm-status]') || {}).textContent || '';
      return { open: d ? d.open : false, title, kicker, body: body.slice(0, 160), mission: mission.slice(0, 120), status: status.slice(0, 120) };
    })()`);
    add(label + ' → applied', r.open && /research json applied/i.test(r.kicker) && expect.test(r.mission), { kicker: r.kicker, mission: r.mission.slice(0, 60) });
    add(label + ' → persistent note', /JSON applied/i.test(r.status), { status: r.status.slice(0, 80) });
    // close the dialog for the next payload
    await page.evaluate(`(() => { const c=document.getElementById('jfDlgClose'); if (c) c.click(); })()`);
    await sleep(400);
  }

  // a payload that cannot be repaired should explain itself
  await page.evaluate(`(() => { const b=document.querySelector('[data-sm-act="rjsonshow"]'); const box=document.querySelector('.sm-json'); if (box && box.hidden && b) b.click(); })()`);
  await sleep(400);
  await page.evaluate(`(() => { const ta=document.querySelector('[data-sm-json]'); ta.value='{"mission": }'; const b=document.querySelector('[data-sm-act="rjson"]'); if (b) b.click(); })()`);
  await sleep(1400);
  const bad = await page.evaluate(`(() => {
    const d = document.getElementById('jfDialog');
    return { open: d ? d.open : false, kicker: (document.getElementById('jfDlgKicker') || {}).textContent || '', body: ((document.getElementById('jfDlgBody') || {}).textContent || '').slice(0, 200) };
  })()`);
  add('unrepairable JSON explains itself in a dialog', bad.open && /could not read/i.test(bad.kicker) && /no readable json/i.test(bad.body), bad);
  add('no console errors', page.allErrors().length === 0, { errors: page.allErrors().map((e) => String(e.text).slice(0, 120)) });
} catch (e) {
  add('fatal', false, { error: e.message });
} finally {
  await browser.close();
  const s = { total: checks.length, passed: checks.filter((c) => c.p).length, failed: checks.filter((c) => !c.p) };
  fs.writeFileSync(path.resolve('reports/verify7.json'), JSON.stringify({ checks, summary: s }, null, 2));
  console.log(JSON.stringify(s));
}
