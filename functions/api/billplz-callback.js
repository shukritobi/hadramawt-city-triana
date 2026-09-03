const text = (body, status = 200) => new Response(body, { status, headers:{ 'content-type':'text/plain; charset=utf-8', 'cache-control':'no-store' } });

async function hmacSha256Hex(key, source) {
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(source));
  return [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2,'0')).join('');
}

function sourceString(entries) {
  return entries
    .filter(([key]) => key !== 'x_signature')
    .map(([key,value]) => `${key}${value ?? ''}`)
    .sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .join('|');
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.BILLPLZ_X_SIGNATURE_KEY) return text('Not configured', 503);
  const form = await request.formData();
  const entries = [...form.entries()].map(([k,v]) => [k, String(v)]);
  const supplied = String(form.get('x_signature') || '');
  if (!supplied) return text('Missing signature', 401);
  const expected = await hmacSha256Hex(env.BILLPLZ_X_SIGNATURE_KEY, sourceString(entries));
  if (expected.toLowerCase() !== supplied.toLowerCase()) return text('Invalid signature', 401);

  const billId = String(form.get('id') || '');
  const state = String(form.get('state') || '');
  const paid = String(form.get('paid') || '').toLowerCase() === 'true' && state === 'paid';
  const amount = Number.parseInt(String(form.get('amount') || '0'), 10);
  const transactionId = String(form.get('transaction_id') || '');
  if (!billId) return text('Missing bill id', 400);

  const order = await env.DB.prepare(`SELECT id, amount_cents, status FROM orders WHERE billplz_bill_id=?`).bind(billId).first();
  if (!order) return text('Order not found', 404);
  if (amount && Number(order.amount_cents) !== amount) return text('Amount mismatch', 409);

  if (paid) {
    await env.DB.prepare(`UPDATE orders SET status='paid', billplz_state='paid', transaction_id=?, paid_at=COALESCE(paid_at, datetime('now')), updated_at=datetime('now') WHERE id=?`)
      .bind(transactionId || null, order.id).run();
  } else {
    await env.DB.prepare(`UPDATE orders SET billplz_state=?, updated_at=datetime('now') WHERE id=?`).bind(state || 'due', order.id).run();
  }
  return text('OK');
}
