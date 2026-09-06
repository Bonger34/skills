// 递归遍历 iframe 树,寻找"修改答案"元素及其所在文档 URL(支持 flatten sessionId)
// 用途:从学习通课程页(studentstudy / knowledge/cards)定位任意作业的编辑页(doHomeWorkNew)完整 URL
// 用法: node find-reediter.mjs <cdp-ws-url>
//   前提:agent-browser --session <SESSION_NAME> 已打开目标作业的课程页(并在目录中点开作业详情)
//   输出:COUNT + 每个匹配项的 depth/url/onclick(含 reediter)/parentHTML;url 即编辑页地址
const url = process.argv[2];
const ws = new WebSocket(url);
let id = 0;
const pending = new Map();
function send(method, params, sessionId) {
  return new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    const msg = { id: i, method, params };
    if (sessionId) msg.sessionId = sessionId;
    ws.send(JSON.stringify(msg));
  });
}
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
  }
};

async function evalIn(sessionId, expr) {
  const r = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
}

async function main() {
  const { targetInfos } = await send('Target.getTargets', {});
  // 多课程页同时打开时优先 courseId=241169786 的目标;否则取第一个 studentstudy 页并打印提示
  const cands = targetInfos.filter(t => t.type === 'page' && (t.url.includes('studentstudy') || t.url.includes('knowledge/cards')));
  let page = cands.find(t => t.url.includes('courseId=241169786')) || cands[0] || null;
  if (cands.length > 1 && !cands.some(t => t.url.includes('courseId=241169786'))) {
    console.log('WARN: 多个课程页,选中第一个;期望 URL 含 courseId=241169786');
  }
  if (!page) { console.log('NO PAGE'); ws.close(); return; }
  console.log('PAGE:', page.url.slice(0, 150));

  const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);

  const probe = `
    (async () => {
      const results = [];
      const seen = new Set();
      async function walk(doc, depth) {
        let loc = '';
        try { loc = doc.location.href || ''; } catch (e) { loc = '(cross)'; }
        try {
          const els = [...doc.querySelectorAll('a, span, div, button')];
          for (const e of els) {
            const t = (e.textContent || '').trim();
            if (t.includes('修改答案') && t.length < 30) {
              results.push({
                depth, url: loc,
                tag: e.tagName, txt: t,
                onclick: (e.getAttribute('onclick') || '').slice(0, 200),
                href: (e.getAttribute('href') || '').slice(0, 300),
                parentHTML: (e.parentElement ? e.parentElement.outerHTML.slice(0, 300) : ''),
              });
            }
          }
        } catch (e) {}
        let iframes = [];
        try { iframes = [...doc.querySelectorAll('iframe')]; } catch (e) {}
        for (const f of iframes) {
          try {
            const cd = f.contentDocument;
            if (cd && !seen.has(cd)) { seen.add(cd); await walk(cd, depth + 1); }
          } catch (e) {}
        }
      }
      seen.add(document);
      await walk(document, 0);
      return { count: results.length, results: results.slice(0, 20) };
    })()
  `;
  const out = await evalIn(sessionId, probe);
  console.log('COUNT:', out.count);
  for (const r of out.results) {
    console.log('--- depth', r.depth, '|', r.tag, '|', r.txt);
    console.log('  url:', r.url);
    console.log('  onclick:', r.onclick);
    console.log('  href:', r.href);
    console.log('  parent:', (r.parentHTML || '').replace(/\s+/g, ' '));
  }
  ws.close();
}

ws.onerror = (e) => { console.error('WS ERROR: cannot connect to CDP URL — re-fetch with `agent-browser get cdp-url` and retry;', e.message || ''); process.exit(1); };
ws.onopen = () => { main().catch((e) => { console.log('ERR', e.message); ws.close(); }); };
