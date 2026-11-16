ALTER TABLE raiz_nudo.orders ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS raiz_nudo.email_notifications (
  order_id uuid PRIMARY KEY REFERENCES raiz_nudo.orders(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','failed','sent')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  sent_at timestamptz,
  provider_id text,
  last_error text
);
CREATE TABLE IF NOT EXISTS raiz_nudo.admin_login_attempts (
  ip_hash text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1
);
INSERT INTO raiz_nudo.schema_migrations(version) VALUES ('002_admin_notifications') ON CONFLICT DO NOTHING;
