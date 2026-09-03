CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_mobile TEXT NOT NULL,
  customer_email TEXT,
  pickup_at TEXT NOT NULL,
  notes TEXT,
  items_json TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  billplz_bill_id TEXT UNIQUE,
  billplz_url TEXT,
  billplz_state TEXT,
  transaction_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_billplz_bill_id ON orders(billplz_bill_id);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_at ON orders(pickup_at);
