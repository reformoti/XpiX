import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import worker, { sha3 } from '../worker/index.js';
const origin = 'https://example.test';
const env = { LIQPAY_PUBLIC_KEY:'i_test_merchant', LIQPAY_PRIVATE_KEY:'private-test-key', SESSION_SECRET:'s'.repeat(48), CONTACT_PHONE:'+380000000000', PAYMENTS_ENABLED:'true', PUBLIC_ORIGIN:origin };
const request = (path, options={}) => new Request(origin+path, options);
const fetchWorker = (path, options={}, config=env) => worker.fetch(request(path,options),config);
async function checkout() {
  const response = await fetchWorker('/api/checkout',{method:'POST',headers:{origin}});
  assert.equal(response.status,200);
  const body = await response.json();
  return {cookie:response.headers.get('set-cookie').split(';')[0],payload:JSON.parse(Buffer.from(body.data,'base64')),body};
}
function successful(order, override={}) { return {status:'success',action:'pay',order_id:order,public_key:env.LIQPAY_PUBLIC_KEY,amount:'0.40',currency:'USD',...override}; }
test('SHA3-256 agrees with independent Node crypto vectors and block boundaries', () => {
  for (const bytes of [Buffer.from(''),Buffer.from('abc'),Buffer.from('XpiX — яблоко'),...Array.from({length:16},(_,i)=>randomBytes([1,32,135,136,137,271,272,273][i%8]))]) {
    assert.equal(Buffer.from(sha3(bytes)).toString('hex'),createHash('sha3-256').update(bytes).digest('hex'));
  }
});
test('unconfigured site never exposes the phone or permits payment', async () => {
  assert.equal((await (await fetchWorker('/api/config',{},{})).json()).paymentsEnabled,false);
  const response = await fetchWorker('/api/contact?paid=true&amount=0.4',{},env);
  assert.equal((await response.json()).unlocked,false);
  assert.equal((await fetchWorker('/api/checkout',{method:'POST',headers:{origin}},{})).status,503);
  assert.equal((await (await fetchWorker('/api/config',{}, {...env,PAYMENTS_ENABLED:'false'})).json()).paymentsEnabled,false);
  assert.equal((await (await fetchWorker('/api/config',{}, {...env,LIQPAY_PUBLIC_KEY:'sandbox_123'})).json()).paymentsEnabled,false);
});
test('cross-origin and missing-origin requests cannot start checkout', async () => {
  for (const header of [{},{origin:'https://attacker.test'}]) assert.equal((await fetchWorker('/api/checkout',{method:'POST',headers:header})).status,403);
});
test('checkout fixes the price, signs v7 data, and creates a private browser-bound cookie', async () => {
  const response = await fetchWorker('/api/checkout',{method:'POST',headers:{origin},body:'{"amount":0,"phone":"steal"}'});
  const body = await response.json();
  const data = JSON.parse(Buffer.from(body.data,'base64'));
  assert.equal(data.amount,0.4);assert.equal(data.currency,'USD');assert.equal(data.version,7);assert.equal(data.action,'pay');
  assert.equal(body.signature,createHash('sha3-256').update(env.LIQPAY_PRIVATE_KEY+body.data+env.LIQPAY_PRIVATE_KEY).digest('base64'));
  assert.match(data.order_id,/^xpix_/);assert.equal(data.result_url,origin+'/?payment=return#contact');
  assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/Secure/);assert.match(response.headers.get('set-cookie'),/SameSite=Lax/);
  assert.ok(!JSON.stringify(body).includes(env.CONTACT_PHONE));
});
test('unpaid, sandbox, wrong merchant/order/amount/currency/action, and reversed orders stay locked', async () => {
  const {cookie,payload} = await checkout();
  const originalFetch = globalThis.fetch;
  try {
    const variants=[{status:'processing'},{status:'failure'},{status:'reversed'},{status:'sandbox'},{sandbox:'1'},{sandbox:true},{public_key:'other'},{order_id:'other'},{amount:0.39},{amount:0},{amount:'NaN'},{currency:'UAH'},{action:'hold'}];
    for (const variant of variants) {
      globalThis.fetch=async()=>Response.json(successful(payload.order_id,variant));
      const response=await fetchWorker('/api/contact',{headers:{cookie}});
      assert.equal(response.headers.get('cache-control'),'no-store, private');
      const body=await response.json();assert.equal(body.unlocked,false,JSON.stringify(variant));assert.ok(!JSON.stringify(body).includes(env.CONTACT_PHONE));
    }
  } finally {globalThis.fetch=originalFetch;}
});
test('only provider-confirmed paid orders reveal the phone, including settlement pending', async () => {
  const {cookie,payload} = await checkout();
  const originalFetch=globalThis.fetch;
  try {
    for (const state of ['success','wait_compensation']) {
      globalThis.fetch=async(url,options)=>{
        assert.equal(url,'https://www.liqpay.ua/api/request');
        const fields=options.body;const sent=JSON.parse(Buffer.from(fields.get('data'),'base64'));assert.equal(sent.action,'status');assert.equal(sent.order_id,payload.order_id);
        return Response.json(successful(payload.order_id,{status:state}));
      };
      const body=await (await fetchWorker('/api/contact',{headers:{cookie}})).json();
      assert.equal(body.unlocked,true);assert.equal(body.phone,env.CONTACT_PHONE);
    }
  } finally {globalThis.fetch=originalFetch;}
});
test('forged cookies cannot contact the provider or reveal a phone', async () => {
  const {cookie}=await checkout();const originalFetch=globalThis.fetch;
  try {
    globalThis.fetch=()=>{throw new Error('Provider should not be queried');};
    for (const forged of ['xpix_order=invalid',cookie.slice(0,-5)+'aaaaa']) {
      const body=await (await fetchWorker('/api/contact',{headers:{cookie:forged}})).json();
      assert.equal(body.unlocked,false);assert.equal(body.hasOrder,false);
    }
  } finally {globalThis.fetch=originalFetch;}
});
test('provider failure fails closed and does not disclose internals', async () => {
  const {cookie}=await checkout();const originalFetch=globalThis.fetch;
  try {
    globalThis.fetch=async()=>{throw new Error(env.LIQPAY_PRIVATE_KEY);};
    const response=await fetchWorker('/api/contact',{headers:{cookie}});assert.equal(response.status,502);
    const body=await response.text();assert.ok(!body.includes(env.LIQPAY_PRIVATE_KEY));assert.ok(!body.includes(env.CONTACT_PHONE));
  } finally {globalThis.fetch=originalFetch;}
});
test('pending checkout reuses its order and public status queries cannot select another order',async()=>{
  const first=await checkout();
  const second=await (await fetchWorker('/api/checkout',{method:'POST',headers:{origin,cookie:first.cookie}})).json();
  assert.equal(JSON.parse(Buffer.from(second.data,'base64')).order_id,first.payload.order_id);
  const body=await (await fetchWorker('/api/contact?order_id='+first.payload.order_id)).json();assert.equal(body.unlocked,false);
});
