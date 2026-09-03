const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers:{ 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' } });

async function syncFromBillplz(env, billId) {
  if (!env.BILLPLZ_SECRET_KEY) return null;
  const mode = String(env.BILLPLZ_MODE || 'sandbox').toLowerCase();
  const base = mode === 'production' ? 'https://www.billplz.com' : 'https://www.billplz-sandbox.com';
  const auth = btoa(`${env.BILLPLZ_SECRET_KEY}:`);
  const response = await fetch(`${base}/api/v3/bills/${encodeURIComponent(billId)}`, { headers:{ authorization:`Basic ${auth}` } });
  if (!response.ok) return null;
  return response.json();
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ message:'Order tracking is not configured.' }, 503);
  const url = new URL(request.url);
  const billId = url.searchParams.get('bill_id');
  if (!billId) return json({ message:'Missing bill id.' }, 400);
  let order = await env.DB.prepare(`SELECT id, pickup_at, amount_cents, status, billplz_state, billplz_bill_id FROM orders WHERE billplz_bill_id=?`).bind(billId).first();
  if (!order) return json({ message:'Order not found.' }, 404);

  if (order.status !== 'paid') {
    try {
      const bill = await syncFromBillplz(env, billId);
      if (bill?.paid === true && bill?.state === 'paid' && Number(bill.amount) === Number(order.amount_cents)) {
        await env.DB.prepare(`UPDATE orders SET status='paid', billplz_state='paid', paid_at=COALESCE(paid_at, datetime('now')), updated_at=datetime('now') WHERE id=?`).bind(order.id).run();
        order = { ...order, status:'paid', billplz_state:'paid' };
      }
    } catch (error) { console.error('Billplz status sync failed', error); }
  }
  return json({ orderId:order.id, pickupAt:order.pickup_at, amountCents:Number(order.amount_cents), status:order.status, paymentState:order.billplz_state || 'due' });
}
