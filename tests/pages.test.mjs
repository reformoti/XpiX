import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../',import.meta.url);
test('GitHub Pages assets resolve below a project path and no server secrets are included',async()=>{
  const html=await readFile(new URL('docs/index.html',root),'utf8');
  assert.match(html,/<meta name="xpix-runtime" content="static">/);
  for (const [,value] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (value.startsWith('#') || /^https?:/.test(value)) continue;
    assert.ok(value.startsWith('./'),`Asset should be relative to /XpiX/: ${value}`);
    const asset = new URL(value,'https://reformoti.github.io/XpiX/');
    assert.ok(asset.pathname.startsWith('/XpiX/'));
    await access(new URL('docs/'+value.replace(/^\.\//,'').split('?')[0],root));
  }
  for (const name of ['index.html','app.js','style.css','favicon.svg']) {
    const content=await readFile(new URL('docs/'+name,root),'utf8');
    assert.ok(!/CONTACT_PHONE|LIQPAY_PRIVATE_KEY|SESSION_SECRET/.test(content));
    assert.ok(!/\+380\s?50\s?508\s?\d{2}\s?\d{2}/.test(content),'Unmasked contact must not be in the public site');
  }
});
test('static page never contacts a payment API or unlocks from a return URL',async()=>{
  const elements=new Map();
  function element(selector) {
    if(!elements.has(selector)) elements.set(selector,{textContent:'',hidden:false,disabled:false,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},showModal(){this.open=true;},close(){this.open=false;}});
    return elements.get(selector);
  }
  const canvas=element('#apple');
  canvas.width=1000; canvas.height=760;
  canvas.getContext=()=>({clearRect(){},beginPath(){},ellipse(){},stroke(){},moveTo(){},lineTo(){},bezierCurveTo(){},quadraticCurveTo(){}});
  const document={hidden:false,querySelector(selector){return selector==='meta[name="xpix-runtime"]'?{content:'static'}:element(selector);},addEventListener(){}};
  let requests=0;
  const context={document,window:{matchMedia:()=>({matches:true,addEventListener(){}})},location:{href:'https://reformoti.github.io/XpiX/?payment=success'},URL,Date,console,IntersectionObserver:class{observe(){}},fetch(){requests++;throw new Error('Static site must not call APIs');}};
  const scope=vm.createContext(context);
  vm.runInContext(await readFile(new URL('docs/app.js',root),'utf8'),scope);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests,0);
  assert.equal(element('#pay').disabled,true);
  assert.match(element('#payment-status').textContent,/не подключён/);
  await element('#unlock').handlers.click();
  assert.equal(element('#payment-dialog').open,true);
  await element('#pay').handlers.click();
  assert.equal(requests,0);
  assert.equal(element('#phone').textContent,'');
  assert.notEqual(element('#unlock').hidden,true);
});
