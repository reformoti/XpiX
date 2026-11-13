'use strict';
const $ = (s) => document.querySelector(s);
const STATIC_MODE = document.querySelector('meta[name="xpix-runtime"]')?.content === 'static';
const dialog = $('#payment-dialog');
const pay = $('#pay');
const status = $('#payment-status');
let paymentReady = false;
let busy = false;
let toastTimer;
$('#year').textContent = new Date().getFullYear();
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 5000); }
async function api(path, options = {}) {
  if (STATIC_MODE) throw new Error('Приймання оплати поки не підключено. Кошти не списуються.');
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'Не вдалося зв’язатися із сервером. Спробуйте ще раз.');
  return body;
}
function reveal(phone) {
  $('#phone').textContent = phone;
  $('#phone').setAttribute('aria-label', 'Повний номер телефону засновника XpiX');
  $('#unlock').hidden = true;
  $('#call').hidden = false;
  $('#call').href = 'tel:' + phone.replace(/[^+\d]/g, '');
  $('#payment-note').textContent = 'Номер відкрито. Збережіть його, щоб зв’язатися у зручний час.';
}
async function checkContact(announce = false) {
  const data = await api('/api/contact');
  if (data.unlocked) {
    reveal(data.phone);
    if (dialog.open) dialog.close();
    if (announce) toast('Платіж підтверджено. Номер відкрито.');
  } else if (announce) {
    status.textContent = data.state === 'failed' ? 'Платіж не завершено або кошти повернуто. Номер поки закрито.' : data.hasOrder ? 'Платіж поки не підтверджено. Зачекайте трохи та перевірте ще раз. Повторно платити не потрібно.' : 'У цьому браузері немає замовлення. Відкрийте оплату тут, щоб отримати доступ до номера.';
  }
  $('#verify-payment').hidden = !data.hasOrder;
  return data;
}
async function loadConfig() {
  if (STATIC_MODE) {
    paymentReady = false;
    pay.disabled = true;
    pay.textContent = 'Оплата поки недоступна';
    status.textContent = 'Приймання оплати ще не підключено. Зараз кошти не списуються. Повертайтеся пізніше.';
    $('#payment-note').textContent = 'Приймання оплати поки не підключено. Списання недоступне.';
    return;
  }
  try {
    const data = await api('/api/config');
    paymentReady = data.paymentsEnabled;
    pay.disabled = !paymentReady;
    status.textContent = paymentReady ? 'Оплата карткою через LiqPay. Після повернення на сайт перевіримо платіж і відкриємо номер.' : 'Приймання оплати ще не підключено. Зараз кошти не списуються. Повертайтеся пізніше.';
    $('#payment-note').textContent = paymentReady ? 'Одноразова оплата · номер відкриється після підтвердження платежу.' : 'Приймання оплати поки не підключено. Списання недоступне.';
    if (!paymentReady) pay.textContent = 'Оплата незабаром з’явиться';
  } catch { status.textContent = 'Не вдалося перевірити оплату. Закрийте вікно та спробуйте знову.'; pay.disabled = true; }
}
$('#unlock').addEventListener('click', async () => { dialog.showModal(); await loadConfig(); });
$('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
pay.addEventListener('click', async () => {
  if (!paymentReady || busy) return;
  busy = true; pay.disabled = true; status.textContent = 'Готуємо захищену сторінку оплати…';
  try {
    const contact = await checkContact();
    if (contact.unlocked) return;
    const data = await api('/api/checkout', { method: 'POST' });
    const form = document.createElement('form');
    form.method = 'POST'; form.action = 'https://www.liqpay.ua/api/3/checkout';
    for (const key of ['data', 'signature']) { const field = document.createElement('input'); field.type = 'hidden'; field.name = key; field.value = data[key]; form.append(field); }
    document.body.append(form); form.submit();
  } catch (error) { status.textContent = error.message; pay.disabled = false; }
  finally { busy = false; }
});
$('#verify-payment').addEventListener('click', async (event) => {
  event.currentTarget.disabled = true;
  try { await checkContact(true); } catch (error) { status.textContent = error.message; }
  finally { $('#verify-payment').disabled = false; }
});
async function initPayments() {
  await loadConfig();
  if (STATIC_MODE) return;
  const returned = new URL(location.href).searchParams.has('payment');
  if (returned) { dialog.showModal(); status.textContent = 'Перевіряємо результат платежу…'; }
  try {
    let contact = await checkContact(returned);
    if (returned && !contact.unlocked && contact.hasOrder && paymentReady) {
      for (let attempt = 0; attempt < 3 && !contact.unlocked; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        contact = await checkContact(true);
      }
    }
  } catch { if (returned) status.textContent = 'Перевірка тимчасово недоступна. Натисніть «Перевірити платіж» пізніше. Не оплачуйте повторно.'; }
  if (returned) { const url = new URL(location.href); url.searchParams.delete('payment'); history.replaceState(null, '', url.pathname + url.search + url.hash); }
}
initPayments();
// A small generative study, inspired by the apple at the heart of Apple IQ.
// It is an original illustration, not a screenshot of the game.
const canvas = $('#apple');
const ctx = canvas.getContext('2d');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
let visible = true;
let frame = 0;
let angle = 0.18;
let last = 0;
function point(theta, phi, rotation) {
  const c = Math.cos(phi);
  const r = Math.sin(phi) * (1 + .13 * c) * (1 + .045 * Math.cos(theta * 5) * Math.pow(Math.abs(c), 3));
  const x = Math.cos(theta) * r;
  const z = Math.sin(theta) * r;
  let y = -Math.cos(phi) * .98;
  y += .19 * Math.exp(-Math.pow(phi / .43, 2));
  const xr = x * Math.cos(rotation) - z * Math.sin(rotation);
  const zr = x * Math.sin(rotation) + z * Math.cos(rotation);
  return [canvas.width * .5 + xr * 235, canvas.height * .53 + (y + zr * .12) * 235, zr];
}
function drawApple() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#2b2c27'; ctx.lineWidth = .6;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(w*.5,h*.86,110+i*40,12+i*4,0,0,Math.PI*2);ctx.stroke(); }
  for (let j = 1; j < 26; j++) {
    const phi = j / 26 * Math.PI;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) { const p = point(i / 100 * Math.PI * 2, phi, angle); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.strokeStyle = 'rgba(234,58,43,.57)'; ctx.lineWidth = .9; ctx.stroke();
  }
  for (let i = 0; i < 34; i++) {
    const theta = i / 34 * Math.PI * 2;
    ctx.beginPath();
    for (let j = 1; j < 80; j++) { const p = point(theta, j/80*Math.PI, angle); j === 1 ? ctx.moveTo(p[0],p[1]) : ctx.lineTo(p[0],p[1]); }
    ctx.strokeStyle = 'rgba(234,58,43,.36)'; ctx.lineWidth = .8; ctx.stroke();
  }
  const top = point(0, 0, angle);
  ctx.strokeStyle = '#e34133'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(top[0], top[1]+5); ctx.bezierCurveTo(top[0]-12,top[1]-15,top[0]+5,top[1]-45,top[0]+16,top[1]-60); ctx.stroke();
  ctx.lineWidth = 1;ctx.beginPath();ctx.moveTo(top[0]+1,top[1]-30);ctx.quadraticCurveTo(top[0]+33,top[1]-78,top[0]+84,top[1]-58);ctx.quadraticCurveTo(top[0]+58,top[1]-22,top[0]+1,top[1]-30);ctx.lineTo(top[0]+74,top[1]-55);ctx.stroke();
}
function animate(time) {
  frame = 0;
  if (!visible || document.hidden || reduced.matches) return;
  if (time-last > 40) { angle += .004; drawApple(); last = time; }
  frame = requestAnimationFrame(animate);
}
function resume() { if (!frame && visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(animate); }
new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (!visible) { cancelAnimationFrame(frame); frame=0; } else resume(); }, { rootMargin:'80px' }).observe(canvas);
document.addEventListener('visibilitychange', resume);
reduced.addEventListener('change', () => { if (reduced.matches) { cancelAnimationFrame(frame); frame=0;drawApple(); } else resume(); });
drawApple();
