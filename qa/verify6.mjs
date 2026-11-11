// qa/verify6.mjs — (a) lenient JSON paste in SMARTER program, (b) one-block multi-priority contract.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, PageDriver, sleep, EDGE_PATH } from './cdp.mjs';

const FILE = path.resolve(process.argv[2] || 'AI_Pilot.html');
const CONTRACT = [
  'SMARTER Measurement Contract — Chief Research Enablement Officer (HKS)',
  'Contract parties: CREO ↔ Dean\'s Office / Research Dean (sponsor)',
  'Contract period: 12 months from start date, with 90-day and 6-month checkpoints',
  'Baseline rule: Every metric below requires a baseline established within the first 60 days. No target is final until baselined.',
  '',
  'Priority 1 — Integrate research & library services into one coherent ecosystem',
  'Source: HKS 2036 "Investing in Our Strong Foundation" — transforming research, computing, and data services.',
  '',
  'Element\tContract term',
  'Specific\tPublish a single service catalog covering research computing, data services, library liaison, compliance intake, and sponsored awards support; designate one intake point per service.',
  'Measurable\tCatalog published; ≥90% of services have a named owner and documented SLA; faculty awareness ≥70% (survey).',
  'Achievable\tPhased: catalog draft by day 90, live by month 6.',
  'Relevant\tDirectly enables "efficient research ecosystem" language in the posting.',
  'Time-bound\tDraft day 90; live month 6; awareness survey month 9.',
  'Evaluated\t90-day review (draft quality), 6-month review (live + SLA coverage), 9-month review (awareness).',
  'Revised\tIf awareness <50% at month 9, re-scope outreach and extend target by one quarter with sponsor approval.',
  '',
  'Priority 2 — Reduce faculty time-to-research (administrative friction)',
  'Source: posting — "streamline processes for research compliance and resource access."',
  '',
  'Element\tContract term',
  'Specific\tMap the end-to-end path for the three most common research starts (new grant intake, data use agreement, IRB submission); eliminate or parallelize the top friction steps.',
  'Measurable\tMedian cycle time reduced ≥25% vs. baseline for each of the three paths; faculty satisfaction with research admin ≥4.0/5.0.',
  'Achievable\tBaseline in 60 days; two redesign sprints in months 3–9.',
  'Relevant\tCore "enablement" mandate; ties to HKS retention and faculty cluster-hire goals.',
  'Time-bound\tBaseline day 60; first path redesigned month 5; all three by month 12.',
  'Evaluated\tQuarterly cycle-time dashboard reviewed with Research Dean.',
  'Revised\tIf a path\'s cycle time is externally constrained, re-target to "steps within HKS control" and document the constraint.',
  '',
  'Priority 3 — Research computing, data warehouse & governance',
  'Source: posting — FERPA/HIPAA/FISMA compliance, data use agreements, shared data warehouse.',
  '',
  'Specific\tStand up a governed shared data warehouse service with documented access tiers; complete a compliance control matrix for FERPA, HIPAA, and FISMA; standardize DUA review.',
  'Measurable\tControl matrix covering 100% of in-scope systems; 100% of new DUAs reviewed within 10 business days; zero material audit findings.',
  'Achievable\tLeverage Harvard Library and central IT rather than build net-new.',
  'Relevant\tExplicit in posting; supports HKS technology-for-public-good research.',
  'Time-bound\tMatrix month 6; DUA SLA month 6; warehouse service live month 9.',
  'Evaluated\tMonth 6 compliance review; month 9 service review; annual audit cycle.',
  'Revised\tIf central IT dependencies slip, re-sequence warehouse launch and hold the compliance matrix as the non-negotiable deliverable.',
  '',
  'Governance of the contract itself',
  'Checkpoints: Day 60 (baselines locked), Day 90, Month 6, Month 12.',
  'Dashboard: One page, six priorities, RAG status, reviewed monthly with the Research Dean.',
  'Change control: Any target change requires a written revision note stating the constraint, the new target, and the sponsor\'s sign-off (the "R" in SMARTER).',
  'Non-negotiables: Compliance matrix (P3) and RIO protocol (P4) — these are floor requirements, not stretch goals.',
].join('\n');

const browser = await launchBrowser({ browserPath: EDGE_PATH, browserName: 'edge', windowSize: '1440,900' });
const page = new PageDriver(browser);
const checks = [];
const add = (n, p, i) => { checks.push({ n, p: !!p, i }); console.log(`${p ? 'PASS' : 'FAIL'} ${n} :: ${JSON.stringify(i).slice(0, 300)}`); };
try {
  await page.init();
  await page.navigate(pathToFileURL(FILE).href, { settleMs: 1500 });
  await page.evaluate(`document.getElementById('jfUseProfile').click()`);
  await sleep(1000);
  await page.evaluate(`document.getElementById('jfSample').click()`);
  await sleep(2400);

  // ---- (a) lenient JSON ----
  const tryJson = async (payload) => {
    await page.evaluate(`(() => { const t=[...document.querySelectorAll('#jobFitPanel [role=tab], #jobFitPanel .jf-tab')].find(x=>/SMARTER program/i.test(x.textContent||'')); if (t) t.click(); })()`);
    await sleep(1100);
    await page.evaluate(`(() => { const b=document.querySelector('[data-sm-act="rjsonshow"]'); const box=document.querySelector('.sm-json'); if (box && box.hidden && b) b.click(); })()`);
    await sleep(500);
    await page.evaluate(`(() => { const ta=document.querySelector('[data-sm-json]'); ta.value=${JSON.stringify(payload)}; const b=document.querySelector('[data-sm-act="rjson"]'); if (b) b.click(); })()`);
    await sleep(1600);
    return page.evaluate(`(() => {
      const m = document.querySelector('[data-sm-r="mission"]');
      const st = document.querySelector('[data-sm-status]');
      const kicker = (document.getElementById('jfDlgKicker') || {}).textContent || '';
      const body = ((document.getElementById('jfDlgBody') || {}).textContent || '').slice(0, 200);
      return { mission: m ? m.value.slice(0, 90) : '', status: st ? st.textContent.trim().slice(0, 120) : '', kicker, body };
    })()`);
  };
  const curly = await tryJson('{\u201corganization\u201d:\u201cCurly Org\u201d,\u201cmission\u201d:{\u201ctext\u201d:\u201cCurly-quoted mission.\u201d,\u201curl\u201d:\u201chttps://example.edu/m\u201d},\u201cinitiatives\u201d:[]}');
  add('JSON with typographic quotes applies', /Curly-quoted mission/.test(curly.mission), curly);
  const comma = await tryJson('{"organization":"Comma Org","mission":{"text":"Trailing-comma mission.","url":"https://example.edu/m"},"initiatives":[{"name":"TC","status":"current","url":""},],}');
  add('JSON with trailing commas applies', /Trailing-comma mission/.test(comma.mission), comma);
  const multi = await tryJson('Here you go. {"organization":"Multi Org","mission":{"text":"First object mission.","url":""}} and also {"organization":"Second","mission":{"text":"Second object mission.","url":""}} thanks');
  add('JSON surrounded by prose applies', /object mission/.test(multi.mission), multi);
  const bad = await tryJson('{"totally_unknown_key":1,"another":2}');
  add('unrecognised JSON reports a clear message', /could not read/i.test(bad.kicker) && /no research fields were recognised/i.test(bad.body), bad);

  // ---- (b) one-block contract ----
  await page.evaluate(`document.getElementById('viewWorkSample').click()`);
  await sleep(1500);
  // reveal details so the form is usable, then paste the contract
  await page.evaluate(`(() => { const d=document.querySelector('[data-apx-det="ws"]'); if (d && d.getAttribute('aria-expanded') !== 'true') d.click(); })()`);
  await sleep(600);
  await page.evaluate(`(() => { const c=document.getElementById('wsContract'); c.value=${JSON.stringify(CONTRACT)}; c.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await page.evaluate(`(() => { const b=document.getElementById('wsBuild'); if (b) b.click(); })()`);
  await sleep(2500);
  const ws = await page.evaluate(`(() => ({
    spec: document.getElementById('wsSpec').textContent || '',
    prompt: document.getElementById('wsPrompt').textContent || '',
    meter: (document.getElementById('wsMeterValue') || {}).textContent || '',
  }))()`);
  add('spec renders the contract as ONE block', /SMARTER measurement contract — one block, 3 priorities/.test(ws.spec), { head: (ws.spec.match(/.{0,30}SMARTER measurement contract.{0,80}/) || [''])[0] });
  add('spec keeps every priority', /Priority 1 —/.test(ws.spec) && /Priority 2 —/.test(ws.spec) && /Priority 3 —/.test(ws.spec), {});
  add('spec keeps the governance section', /Governance of the contract itself/.test(ws.spec), {});
  add('spec no longer shows the seven-letter strip', !/3\. SMARTER strip/.test(ws.spec) && !/Acceptable|A\. Attain/i.test(ws.spec.slice(ws.spec.indexOf('3.'), ws.spec.indexOf('4.'))), {});
  add('build prompt carries the whole contract', /SMARTER measurement contract — ONE block, 3 priorities/.test(ws.prompt) && /Reduce faculty time-to-research/.test(ws.prompt), { chars: ws.prompt.length });
  add('build prompt forbids splitting into letters', /do not split it into seven separate letter fields/i.test(ws.prompt), {});
  add('completeness meter counts the contract', /\d+/.test(ws.meter) && parseInt(ws.meter, 10) > 0, { meter: ws.meter });

  // a JSON contract is accepted in the same box
  const JSON_CONTRACT = JSON.stringify({
    contract_parties: 'CREO ↔ Dean', contract_period: '12 months', baseline_rule: 'within 60 days',
    priorities: [
      { n: 1, title: 'Integrate services', source: 'HKS 2036', specific: 'Publish a catalog', measurable: '90% coverage', achievable: 'Draft by 90 days', relevant: 'Ecosystem language', timeBound: 'Live month 6', evaluated: '90-day review', revised: 'Re-scope' },
      { n: 2, title: 'Reduce time', specific: 'Map paths', measurable: '25%', achievable: '60 days', relevant: 'Core mandate', timeBound: 'Month 12', evaluated: 'Quarterly', revised: 'Re-target' },
    ],
    governance: ['Checkpoints: Day 60, 90, 6m, 12m'],
  });
  await page.evaluate(`(() => { const c=document.getElementById('wsContract'); c.value=${JSON.stringify(JSON_CONTRACT)}; c.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('wsBuild').click(); })()`);
  await sleep(2200);
  const wsJson = await page.evaluate(`(() => ({ spec: document.getElementById('wsSpec').textContent || '', prompt: document.getElementById('wsPrompt').textContent || '' }))()`);
  add('JSON contract also renders as one block', /one block, 2 priorities/.test(wsJson.spec) && /Priority 2 — Reduce time/.test(wsJson.spec), { head: (wsJson.spec.match(/.{0,30}one block, 2 priorities.{0,60}/) || [''])[0] });
  add('JSON contract reaches the build prompt', /ONE block, 2 priorities/.test(wsJson.prompt), {});

  add('no console errors', page.allErrors().length === 0, { errors: page.allErrors().map((e) => String(e.text).slice(0, 120)) });
} catch (e) {
  add('fatal', false, { error: e.message });
} finally {
  await browser.close();
  const s = { total: checks.length, passed: checks.filter((c) => c.p).length, failed: checks.filter((c) => !c.p) };
  fs.writeFileSync(path.resolve('reports/verify6.json'), JSON.stringify({ checks, summary: s }, null, 2));
  console.log(JSON.stringify(s));
}

