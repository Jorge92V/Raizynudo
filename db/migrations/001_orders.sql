CREATE SCHEMA IF NOT EXISTS raiz_nudo;
CREATE TABLE IF NOT EXISTS raiz_nudo.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS raiz_nudo.orders (
  id uuid PRIMARY KEY,
  request_key uuid NOT NULL UNIQUE,
  fingerprint text NOT NULL,
  folio text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  customer jsonb NOT NULL,
  delivery jsonb NOT NULL,
  design jsonb NOT NULL,
  pricing jsonb NOT NULL,
  product_cents integer NOT NULL CHECK (product_cents > 0),
  deposit_cents integer NOT NULL CHECK (deposit_cents >= 0),
  shipping_cents integer CHECK (shipping_cents >= 0),
  status text NOT NULL DEFAULT 'Recibido' CHECK (status IN ('Recibido','En revisión','Pendiente de anticipo','Confirmado','En producción','Listo','Enviado','Entregado')),
  production_days integer NOT NULL DEFAULT 7 CHECK (production_days = 7),
  paid_at timestamptz,
  production_due date,
  schema_version integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS orders_created_idx ON raiz_nudo.orders(created_at DESC);
CREATE TABLE IF NOT EXISTS raiz_nudo.order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES raiz_nudo.orders(id),
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO raiz_nudo.schema_migrations(version) VALUES ('001_orders') ON CONFLICT DO NOTHING;
