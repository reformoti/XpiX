const assets = {}; // BUILD_ASSETS
const MASKED_PHONE = '+380 50 508 •• ••';
const PRICE = 0.40;
const CURRENCY = 'USD';
const COOKIE = 'xpix_order';
const MAX_AGE = 30 * 24 * 60 * 60;
const encoder = new TextEncoder();
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action https://www.liqpay.ua; base-uri 'none'; object-src 'none'"
};
function json(body, status = 200, extra = {}) { return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store, private', ...extra } }); }
function base64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function encode(value) { return base64(encoder.encode(JSON.stringify(value))); }
function base64url(bytes) { return base64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function decode64(value) { return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), x => x.charCodeAt(0)); }
async function hmac(data, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}
async function tokenFor(order, secret) {
  const data = base64url(encoder.encode(JSON.stringify(order)));
  return data + '.' + base64url(await hmac(data, secret));
}
async function readOrder(request, env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return null;
  try {
    const cookie = request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
    if (!cookie || cookie.length > 1500) return null;
    const parts = cookie.split('.');
    if (parts.length !== 2) return null;
    const key = await crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), {name:'HMAC',hash:'SHA-256'}, false, ['verify']);
    if (!await crypto.subtle.verify('HMAC', key, decode64(parts[1]), encoder.encode(parts[0]))) return null;
    const order = JSON.parse(new TextDecoder().decode(decode64(parts[0])));
    if (!/^xpix_[a-f0-9-]{36}$/.test(order.id) || !Number.isSafeInteger(order.created) || order.created > Date.now()+60000 || Date.now()-order.created > MAX_AGE*1000) return null;
    return order;
  } catch { return null; }
}
// FIPS 202 SHA3-256 (Keccak-f[1600]); used by LiqPay API version 7.
// Known vectors and randomized Node crypto comparisons live in tests/payment.test.mjs.
export function sha3(input) {
  const mask = (1n<<64n)-1n;
  const rotations = [0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
  const constants = [0x1n,0x8082n,0x800000000000808an,0x8000000080008000n,0x808bn,0x80000001n,0x8000000080008081n,0x8000000000008009n,0x8an,0x88n,0x80008009n,0x8000000an,0x8000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x800an,0x800000008000000an,0x8000000080008081n,0x8000000000008080n,0x80000001n,0x8000000080008008n];
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  const padded = new Uint8Array(Math.ceil((bytes.length+1)/136)*136);
  padded.set(bytes); padded[bytes.length] ^= 6; padded[padded.length-1] ^= 128;
  const a = Array(25).fill(0n);
  const rot = (v,n) => n ? ((v<<BigInt(n))|(v>>BigInt(64-n)))&mask : v;
  for(let offset=0;offset<padded.length;offset+=136) {
    for(let i=0;i<136;i++) a[i>>3] ^= BigInt(padded[offset+i]) << BigInt((i%8)*8);
    for(const rc of constants) {
      const c=Array(5).fill(0n),d=[],b=Array(25).fill(0n);
      for(let x=0;x<5;x++) for(let y=0;y<5;y++) c[x]^=a[x+5*y];
      for(let x=0;x<5;x++) d[x]=c[(x+4)%5]^rot(c[(x+1)%5],1);
      for(let x=0;x<5;x++) for(let y=0;y<5;y++) a[x+5*y]^=d[x];
      for(let x=0;x<5;x++) for(let y=0;y<5;y++) b[y+5*((2*x+3*y)%5)]=rot(a[x+5*y],rotations[x+5*y]);
      for(let x=0;x<5;x++) for(let y=0;y<5;y++) a[x+5*y]=(b[x+5*y]^((~b[(x+1)%5+5*y])&b[(x+2)%5+5*y]))&mask;
      a[0]^=rc;
    }
  }
  return Uint8Array.from({length:32},(_,i)=>Number((a[i>>3]>>BigInt((i%8)*8))&255n));
}
function signedPayload(payload, env) { const data = encode(payload); return { data, signature:base64(sha3(env.LIQPAY_PRIVATE_KEY+data+env.LIQPAY_PRIVATE_KEY)) }; }
function ready(env) {
  return env.PAYMENTS_ENABLED === 'true' && Boolean(env.LIQPAY_PUBLIC_KEY && env.LIQPAY_PRIVATE_KEY && env.SESSION_SECRET?.length >= 32 && /^\+\d{10,15}$/.test(env.CONTACT_PHONE || '') && env.PUBLIC_ORIGIN && !env.LIQPAY_PUBLIC_KEY.startsWith('sandbox_'));
}
async function paymentStatus(order, env) {
  const body = signedPayload({version:7,public_key:env.LIQPAY_PUBLIC_KEY,action:'status',order_id:order.id},env);
  const response = await fetch('https://www.liqpay.ua/api/request', {method:'POST', body:new URLSearchParams(body), signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('Provider unavailable');
  const payment = await response.json();
  const paid = ['success','wait_compensation'].includes(payment.status) && payment.action === 'pay' && payment.order_id === order.id && payment.public_key === env.LIQPAY_PUBLIC_KEY && payment.currency === CURRENCY && Number.isFinite(Number(payment.amount)) && Math.abs(Number(payment.amount)-PRICE) < 0.000001 && payment.sandbox !== '1' && payment.sandbox !== 1 && payment.sandbox !== true;
  return { paid, state:['failure','error','reversed'].includes(payment.status) ? 'failed':'pending' };
}
export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path.startsWith('/api/')) {
      try {
        if (path === '/api/config' && request.method === 'GET') return json({paymentsEnabled:ready(env),price:PRICE,currency:CURRENCY,maskedPhone:MASKED_PHONE});
        if (path === '/api/contact' && request.method === 'GET') {
          const order = await readOrder(request,env);
          if (!ready(env) || !order) return json({unlocked:false,phone:MASKED_PHONE,hasOrder:Boolean(order),state:'pending'});
          const payment = await paymentStatus(order,env);
          return json({unlocked:payment.paid,phone:payment.paid ? env.CONTACT_PHONE : MASKED_PHONE,hasOrder:true,state:payment.paid?'paid':payment.state});
        }
        if (path === '/api/checkout' && request.method === 'POST') {
          if (request.headers.get('origin') !== url.origin || (env.PUBLIC_ORIGIN && url.origin !== new URL(env.PUBLIC_ORIGIN).origin)) return json({message:'Неприпустиме джерело запиту.'},403);
          if (!ready(env)) return json({message:'Приймання оплати поки не підключено. Кошти не списуються.'},503);
          let order = await readOrder(request,env);
          if (!order || Date.now()-order.created > 23*60*60*1000) order = {id:'xpix_'+crypto.randomUUID(),created:Date.now()};
          const result_url = new URL('/?payment=return#contact', env.PUBLIC_ORIGIN).href;
          const expiry = new Date(order.created+24*60*60*1000).toISOString().slice(0,19).replace('T',' ');
          const payload = signedPayload({version:7,public_key:env.LIQPAY_PUBLIC_KEY,action:'pay',amount:PRICE,currency:CURRENCY,description:'XpiX — одноразовий доступ до номера засновника',order_id:order.id,result_url,expired_date:expiry,language:'uk',paytypes:'card,privat24,apay,gpay'},env);
          const token = await tokenFor(order,env.SESSION_SECRET);
          const cookie = COOKIE+'='+token+'; HttpOnly; SameSite=Lax; Path=/; Max-Age='+MAX_AGE+(url.protocol==='https:'?'; Secure':'');
          return json(payload,200,{'Set-Cookie':cookie});
        }
        return json({message:'Маршрут не знайдено.'},404);
      } catch { return json({message:'Не вдалося перевірити платіж. Спробуйте ще раз пізніше. Повторна оплата не потрібна.'},502); }
    }
    if (!['GET','HEAD'].includes(request.method)) return new Response('Метод не дозволено',{status:405,headers:{...headers,Allow:'GET, HEAD'}});
    const asset = Object.hasOwn(assets,path) ? assets[path] : null;
    if (!asset) return new Response('Не знайдено',{status:404,headers});
    return new Response(request.method==='HEAD'?null:asset.body,{headers:{...headers,'Content-Type':asset.type,'Cache-Control':'no-cache'}});
  }
};
