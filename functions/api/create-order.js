import { getMenuItem, getOption } from '../../shared/menu.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function normaliseMobile(value='') {
  const raw = value.replace(/[^0-9+]/g, '');
  if (raw.startsWith('+60')) return raw;
  if (raw.startsWith('60')) return `+${raw}`;
  if (raw.startsWith('0')) return `+60${raw.slice(1)}`;
  return raw.startsWith('+') ? raw : `+${raw}`;
}

function makeOrderId() {
  const date = new Date().toISOString().slice(0,10).replaceAll('-','');
  const random = crypto.randomUUID().replaceAll('-','').slice(0,6).toUpperCase();
  return `HC-${date}-${random}`;
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.BILLPLZ_SECRET_KEY || !env.BILLPLZ_COLLECTION_ID) {
    return json({ code:'ORDERING_NOT_CONFIGURED', message:'Online ordering is being configured. Please call or WhatsApp the restaurant for now.' }, 503);
  }

  let body;
  try { body = await request.json(); } catch { return json({ message:'Invalid checkout request.' }, 400); }
  const name = String(body?.customer?.name || '').trim();
  const mobile = normaliseMobile(String(body?.customer?.mobile || '').trim());
  const email = String(body?.customer?.email || '').trim();
  const notes = String(body?.notes || '').trim().slice(0,400);
  const pickupAt = String(body?.pickupAt || '');
  const cart = Array.isArray(body?.items) ? body.items : [];

  if (!name || !mobile || !pickupAt || !cart.length) return json({ message:'Name, mobile, pickup time and at least one item are required.' }, 400);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return json({ message:'Please enter a valid email address.' }, 400);
  if (!/^\+?\d{9,16}$/.test(mobile)) return json({ message:'Please enter a valid mobile number.' }, 400);

  const pickupDate = new Date(pickupAt);
  const now = Date.now();
  if (Number.isNaN(pickupDate.getTime()) || pickupDate.getTime() < now + 25 * 60 * 1000 || pickupDate.getTime() > now + 7 * 86400000) {
    return json({ message:'Please choose a valid pickup time within the next 7 days.' }, 400);
  }

  const cleanItems = [];
  let amountCents = 0;
  for (const line of cart.slice(0,60)) {
    const item = getMenuItem(String(line.id || ''));
    const qty = Math.max(1, Math.min(20, Number.parseInt(line.qty,10) || 0));
    const option = getOption(item, String(line.option || ''));
    if (!item || !option || !qty) return json({ message:'One or more cart items are no longer available. Please refresh the menu.' }, 400);
    const unitCents = Math.round(option.price * 100);
    amountCents += unitCents * qty;
    cleanItems.push({ id:item.id, name:item.name, option:option.label, qty, unitCents });
  }
  if (amountCents <= 0 || amountCents > 100000000) return json({ message:'Invalid order total.' }, 400);

  const orderId = makeOrderId();
  await env.DB.prepare(`INSERT INTO orders (id, customer_name, customer_mobile, customer_email, pickup_at, notes, items_json, amount_cents, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment')`)
    .bind(orderId, name, mobile, email || null, pickupDate.toISOString(), notes || null, JSON.stringify(cleanItems), amountCents).run();

  const mode = String(env.BILLPLZ_MODE || 'sandbox').toLowerCase();
  const base = mode === 'production' ? 'https://www.billplz.com' : 'https://www.billplz-sandbox.com';
  const origin = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
  const form = new URLSearchParams();
  form.set('collection_id', env.BILLPLZ_COLLECTION_ID);
  form.set('name', name);
  form.set('mobile', mobile);
  if (email) form.set('email', email);
  form.set('amount', String(amountCents));
  form.set('callback_url', `${origin}/api/billplz-callback`);
  form.set('redirect_url', `${origin}/payment-return.html`);
  form.set('description', `Hadhramawt City pickup ${orderId}`.slice(0,200));
  form.set('reference_1_label', 'Order');
  form.set('reference_1', orderId);
  form.set('reference_2_label', 'Pickup');
  form.set('reference_2', pickupDate.toLocaleString('en-MY', { timeZone:'Asia/Kuala_Lumpur', dateStyle:'medium', timeStyle:'short' }).slice(0,120));
  form.set('deliver', 'false');

  try {
    const auth = btoa(`${env.BILLPLZ_SECRET_KEY}:`);
    const response = await fetch(`${base}/api/v3/bills`, { method:'POST', headers:{ 'authorization':`Basic ${auth}`, 'content-type':'application/x-www-form-urlencoded' }, body:form.toString() });
    const bill = await response.json();
    if (!response.ok || !bill?.id || !bill?.url) throw new Error(bill?.error?.message || bill?.error || `Billplz returned ${response.status}`);
    await env.DB.prepare(`UPDATE orders SET billplz_bill_id=?, billplz_url=?, billplz_state='due', updated_at=datetime('now') WHERE id=?`).bind(bill.id, bill.url, orderId).run();
    return json({ orderId, billUrl:bill.url, amountCents });
  } catch (error) {
    await env.DB.prepare(`UPDATE orders SET status='payment_error', updated_at=datetime('now') WHERE id=?`).bind(orderId).run();
    console.error('Billplz create bill failed', error);
    return json({ message:'We could not open Billplz checkout. Please try again in a moment.' }, 502);
  }
}
