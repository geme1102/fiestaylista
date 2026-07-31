-- ============================================================
-- RLS (Row-Level Security) Migration — Fiesta y Lista
-- ============================================================
-- REFERENCIA LEGACY — NO ejecutar con PgBouncer en modo transacción:
-- las políticas dependen de SET app.current_user_id, que NO es sticky
-- con transaction pooling (cada statement puede caer en otra conexión).
-- Solo sería aplicable con conexiones directas (sin pooler) y ajustando
-- el backend para emitir el SET en cada transacción.
--
-- El runner de migraciones (db/migrate.ts) NUNCA ejecuta este archivo.
-- Corregido a los nombres de columna reales (snake_case).
-- ============================================================

-- Tablas con userId directo
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE arco_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Tablas con eventId (heredan ownership via events)
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_fees ENABLE ROW LEVEL SECURITY;

-- Tablas del sistema (sin RLS — acceso solo interno)
-- failed_webhooks: no contiene datos de usuario
-- migration_journal: metadata de migraciones

-- ============================================================
-- POLÍTICAS — users
-- ============================================================
-- Un usuario solo puede leer/modificar su propia fila
CREATE POLICY users_isolation ON users
  FOR ALL
  USING (id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- Excepción: login necesita buscar por email sin knowing el userId.
-- Crear función SECURITY DEFINER que bypassa RLS para lookup de login.
CREATE OR REPLACE FUNCTION lookup_user_by_email(p_email text)
RETURNS TABLE (id uuid, email text, name text, password_hash text, tier text, email_verified boolean, onboarding_completed boolean, welcome_tutorial_completed boolean, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT id, email, name, password_hash, tier, email_verified, onboarding_completed, welcome_tutorial_completed, created_at
  FROM users
  WHERE email = lower(p_email)
  LIMIT 1;
$$;

-- ============================================================
-- POLÍTICAS — events (owner access)
-- ============================================================
CREATE POLICY events_owner ON events
  FOR ALL
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR id = NULLIF(current_setting('app.current_event_id', true), '')::uuid
  );

-- ============================================================
-- POLÍTICAS — subscriptions
-- ============================================================
CREATE POLICY subs_isolation ON subscriptions
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- ============================================================
-- POLÍTICAS — refresh_tokens
-- ============================================================
CREATE POLICY tokens_isolation ON refresh_tokens
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- ============================================================
-- POLÍTICAS — pro_payments
-- ============================================================
CREATE POLICY payments_isolation ON pro_payments
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- ============================================================
-- POLÍTICAS — email_tracking
-- ============================================================
CREATE POLICY email_tracking_isolation ON email_tracking
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- ============================================================
-- POLÍTICAS — consent_records
-- ============================================================
CREATE POLICY consent_isolation ON consent_records
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- ============================================================
-- POLÍTICAS — arco_requests
-- ============================================================
CREATE POLICY arco_isolation ON arco_requests
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- ============================================================
-- POLÍTICAS — audit_logs
-- ============================================================
CREATE POLICY audit_isolation ON audit_logs
  FOR ALL
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR user_id IS NULL  -- system logs (login failures sin userId conocido)
  );

-- ============================================================
-- POLÍTICAS — gifts (via event ownership)
-- ============================================================
CREATE POLICY gifts_owner ON gifts
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR event_id = NULLIF(current_setting('app.current_event_id', true), '')::uuid
  );

-- ============================================================
-- POLÍTICAS — gift_claims (via gift → event ownership)
-- ============================================================
CREATE POLICY claims_owner ON gift_claims
  FOR ALL
  USING (
    gift_id IN (
      SELECT g.id FROM gifts g
      JOIN events e ON g.event_id = e.id
      WHERE e.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR gift_id IN (
      SELECT g.id FROM gifts g
      WHERE g.event_id = NULLIF(current_setting('app.current_event_id', true), '')::uuid
    )
  );

-- ============================================================
-- POLÍTICAS — photos (via event ownership)
-- ============================================================
CREATE POLICY photos_owner ON photos
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR event_id = NULLIF(current_setting('app.current_event_id', true), '')::uuid
  );

-- ============================================================
-- POLÍTICAS — cash_funds (via event ownership)
-- ============================================================
CREATE POLICY cashfunds_owner ON cash_funds
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR event_id = NULLIF(current_setting('app.current_event_id', true), '')::uuid
  );

-- ============================================================
-- POLÍTICAS — cash_contributions (via fund → event ownership)
-- ============================================================
CREATE POLICY contributions_owner ON cash_contributions
  FOR ALL
  USING (
    cash_fund_id IN (
      SELECT cf.id FROM cash_funds cf
      JOIN events e ON cf.event_id = e.id
      WHERE e.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR cash_fund_id IN (
      SELECT cf.id FROM cash_funds cf
      WHERE cf.event_id = NULLIF(current_setting('app.current_event_id', true), '')::uuid
    )
  );

-- ============================================================
-- POLÍTICAS — messages (via event ownership)
-- ============================================================
CREATE POLICY messages_owner ON messages
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR event_id = NULLIF(current_setting('app.current_event_id', true), '')::uuid
  );

-- ============================================================
-- POLÍTICAS — guests (via event ownership)
-- ============================================================
CREATE POLICY guests_owner ON guests
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR event_id = NULLIF(current_setting('app.current_event_id', true), '')::uuid
  );

-- ============================================================
-- POLÍTICAS — event_views (via event ownership)
-- ============================================================
CREATE POLICY views_owner ON event_views
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR event_id = NULLIF(current_setting('app.current_event_id', true), '')::uuid
  );

-- ============================================================
-- POLÍTICAS — platform_fees (via contribution → fund → event)
-- ============================================================
CREATE POLICY fees_owner ON platform_fees
  FOR ALL
  USING (
    contribution_id IN (
      SELECT cc.id FROM cash_contributions cc
      JOIN cash_funds cf ON cc.cash_fund_id = cf.id
      JOIN events e ON cf.event_id = e.id
      WHERE e.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

-- ============================================================
-- FORCE RLS — asegura que incluso el owner del tabla esté sujeto a RLS
-- ============================================================
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE gifts FORCE ROW LEVEL SECURITY;
ALTER TABLE gift_claims FORCE ROW LEVEL SECURITY;
ALTER TABLE photos FORCE ROW LEVEL SECURITY;
ALTER TABLE cash_funds FORCE ROW LEVEL SECURITY;
ALTER TABLE cash_contributions FORCE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
ALTER TABLE guests FORCE ROW LEVEL SECURITY;
ALTER TABLE pro_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE email_tracking FORCE ROW LEVEL SECURITY;
ALTER TABLE consent_records FORCE ROW LEVEL SECURITY;
ALTER TABLE arco_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE event_views FORCE ROW LEVEL SECURITY;
ALTER TABLE platform_fees FORCE ROW LEVEL SECURITY;
