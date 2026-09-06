// 通过 CDP 在作业编辑页:真实鼠标点击附件按钮 + 注入压缩包文件到上传控件
// 用法: node cdp-upload.mjs <cdp-ws-url> <zip-or-rar-path> [workAnswerId]
// 依赖: Node 22+(内置 WebSocket);逻辑经多轮实战验证
const WS_URL = process.argv[2];
const ZIP_PATH = process.argv[3];
const WORK_ANSWER = process.argv[4] || ''; // 可选:优先匹配的 workAnswerId(多作业 tab 残留时区分)

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    ws.onopen = () => resolve({
      ws,
      send(method, params = {}, sessionId) {
        return new Promise((res, rej) => {
          const mid = ++id;
          pending.set(mid, { res, rej });
          ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
        });
      },
    });
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.rej(new Error(msg.error.message));
        else p.res(msg.result);
      }
    };
    ws.onerror = (e) => reject(new Error('ws error ' + e.message));
  });
}

// UEditor 附件按钮位于顶层文档(工具栏不嵌套 iframe),顶层查询即可;
// 若未来 UEditor 结构变化导致找不到按钮,可复用下方 FIND_INPUT 的 walk 递归。
const GET_RECT = `(function(){var b=document.querySelector('.edui-for-attachment_new');if(!b)return null;var r=b.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`;

const FIND_INPUT = `(function(){
  function walk(doc){
    var ins=Array.from(doc.querySelectorAll('input[type=file]'));
    if(ins.length) return ins[0];
    for (var i=0;i<doc.querySelectorAll('iframe').length;i++){
      var f=doc.querySelectorAll('iframe')[i];var c=null;
      try{c=f.contentDocument}catch(e){}
      if(c){var r=walk(c);if(r)return r}
    }
    return null;
  }
  var el=walk(document);
  if(!el) return 'NOT_FOUND';
  return 'FOUND_' + el.id + '_' + el.className;
})()`;

async function main() {
  const c = await connect(WS_URL);
  const { targetInfos } = await c.send('Target.getTargets');
  // 可能有多个 doHomeWorkNew tab(旧作业残留):优先匹配指定 workAnswerId,否则取第一个
  const prefer = targetInfos.find(t => t.type === 'page' && t.url.includes('doHomeWorkNew') && WORK_ANSWER && t.url.includes(WORK_ANSWER));
  const page = prefer || targetInfos.find(t => t.type === 'page' && t.url.includes('doHomeWorkNew'));
  if (!page) { console.log(JSON.stringify({ err: 'no doHomeWorkNew target' })); process.exit(1); }
  console.log(JSON.stringify({ target: page.targetId, url: page.url.slice(0, 90) }));
  const { sessionId } = await c.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
  await c.send('Runtime.enable', {}, sessionId);
  await c.send('DOM.enable', {}, sessionId);

  // 1) 先看上传面板是否已打开(file input 是否存在)
  const pre = await c.send('Runtime.evaluate', { expression: FIND_INPUT, returnByValue: true }, sessionId);
  const preV = pre.result && pre.result.value;
  console.log(JSON.stringify({ preInput: preV }));

  // 2) 若面板未开,真实鼠标点击附件按钮
  if (!String(preV).startsWith('FOUND_')) {
    const rr = await c.send('Runtime.evaluate', { expression: GET_RECT, returnByValue: true }, sessionId);
    const rect = rr.result && rr.result.value;
    console.log(JSON.stringify({ rect: rect }));
    if (!rect) { console.log(JSON.stringify({ err: 'no attachment btn' })); process.exit(1); }
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y }, sessionId);
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 }, sessionId);
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 }, sessionId);
    console.log(JSON.stringify({ clicked: true }));
  }

  // 3) 等待面板出现并找 file input
  let inputResult = null;
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const fr = await c.send('Runtime.evaluate', { expression: FIND_INPUT, returnByValue: true }, sessionId);
    const v = fr.result && fr.result.value;
    if (v && String(v).startsWith('FOUND_')) { inputResult = v; break; }
  }
  console.log(JSON.stringify({ input: inputResult }));
  if (!inputResult || String(inputResult).startsWith('NOT_FOUND')) {
    console.log(JSON.stringify({ err: 'file input not found after panel open' }));
    process.exit(1);
  }

  // 4) 拿 objectId 并注入文件(表达式需返回元素节点本身;input 可能在 iframe 中)
  const obj = await c.send('Runtime.evaluate', {
    expression: `(function(){
      function walk(doc){
        var ins=Array.from(doc.querySelectorAll('input[type=file]'));
        if(ins.length) return ins[0];
        var fs=Array.from(doc.querySelectorAll('iframe'));
        for (var i=0;i<fs.length;i++){var d=null;try{d=fs[i].contentDocument}catch(e){}if(d){var r=walk(d);if(r)return r}}
        return null;
      }
      return walk(document);
    })()`,
    returnByValue: false
  }, sessionId);
  const objectId = obj.result && obj.result.objectId;
  if (!objectId) { console.log(JSON.stringify({ err: 'no objectId', raw: JSON.stringify(obj).slice(0, 300) })); process.exit(1); }
  await c.send('DOM.setFileInputFiles', { files: [ZIP_PATH], objectId: objectId }, sessionId);
  console.log(JSON.stringify({ injected: true }));

  // 5) 等待上传完成(编辑器内容中出现云/附件标记)
  let contentCheck = '';
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const cr = await c.send('Runtime.evaluate', {
      expression: `(function(){var ue=window.UE&&UE.instants&&UE.instants.ueditorInstant0;if(!ue)return 'NO_UE';var t=ue.getContent&&ue.getContent()||'';return JSON.stringify({len:t.length, hasCloud:t.indexOf('insertCloud')>=0||t.indexOf('editor-iframe')>=0, head:t.slice(0,120)})})()`,
      returnByValue: true
    }, sessionId);
    contentCheck = (cr.result && cr.result.value) || 'null';
    if (String(contentCheck) === 'NO_UE') {
      console.log(JSON.stringify({ err: 'target editor not found (UE.instants.ueditorInstant0 missing) — check the workAnswerId matched target tab and that reediter() was called' }));
      process.exit(1);
    }
    const chk = JSON.parse(contentCheck);
    if (chk.hasCloud) break;
  }
  console.log(JSON.stringify({ content: contentCheck }));
  // 上传判据(与 SKILL.md 一致):hasCloud 必须达成;否则以非零退出码提示自动化
  let ok = false;
  try { ok = JSON.parse(contentCheck).hasCloud === true; } catch (e) { ok = false; }
  if (!ok) {
    console.log(JSON.stringify({ err: 'upload timeout, hasCloud not reached' }));
    process.exit(1);
  }
  process.exit(0);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
