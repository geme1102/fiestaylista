-- ============================================================
-- Role Separation — Fiesta y Lista Neon PostgreSQL
-- ============================================================
-- Ejecutar en Neon SQL Editor como superusuario/owner.
-- Crea dos roles: app (DML solo) y migrator (DDL + DML).
-- Luego asigna GRANTs apropiados.
-- ============================================================

-- ============================================================
-- 1. CREAR ROLES
-- ============================================================

-- Rol de aplicación: solo DML, no puede alterar esquema
CREATE ROLE fylista_app WITH LOGIN PASSWORD 'CAMBIAR_ESTE_PASSWORD' NOCREATEDB NOCREATEROLE NOSUPERUSER;

-- Rol de migración: puede ejecutar DDL + DML
CREATE ROLE fylista_migrator WITH LOGIN PASSWORD 'CAMBIAR_ESTE_PASSWORD_MIGRATOR' NOCREATEDB NOCREATEROLE NOSUPERUSER;

-- ============================================================
-- 2. GRANTs — fylista_app (DML únicamente)
-- ============================================================
-- El rol app solo puede SELECT, INSERT, UPDATE, DELETE
-- No puede CREATE, ALTER, DROP, TRUNCATE, ni ejecutar funciones peligrosas

GRANT CONNECT ON DATABASE neondb TO fylista_app;
GRANT USAGE ON SCHEMA public TO fylista_app;

-- DML en todas las tablas
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fylista_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fylista_app;

-- Permitir uso de la función de login lookup (SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION lookup_user_by_email(text) TO fylista_app;

-- NO conceder CREATE, ALTER, DROP, TRUNCATE
-- NO conceder pg_advisory_lock (requerido por migraciones, no por runtime)
-- Nota: pg_advisory_lock está disponible para todos los roles por defecto en PostgreSQL

-- ============================================================
-- 3. GRANTs — fylista_migrator (DDL + DML)
-- ============================================================

GRANT CONNECT ON DATABASE neondb TO fylista_migrator;
GRANT USAGE, CREATE ON SCHEMA public TO fylista_migrator;

-- DML completo
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fylista_migrator;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fylista_migrator;

-- DDL: permitir alterar tablas, crear índices, etc.
-- PostgreSQL concede esto via el rol owner. fylista_migrator debe ser owner de las tablas
-- o recibir GRANT específicos. La forma más simple es ALTER OWNER:

-- Descomentar las siguientes líneas para transferir ownership a fylista_migrator:
-- ALTER TABLE users OWNER TO fylista_migrator;
-- ALTER TABLE events OWNER TO fylista_migrator;
-- ALTER TABLE gifts OWNER TO fylista_migrator;
-- ALTER TABLE gift_claims OWNER TO fylista_migrator;
-- ALTER TABLE photos OWNER TO fylista_migrator;
-- ALTER TABLE subscriptions OWNER TO fylista_migrator;
-- ALTER TABLE cash_funds OWNER TO fylista_migrator;
-- ALTER TABLE cash_contributions OWNER TO fylista_migrator;
-- ALTER TABLE messages OWNER TO fylista_migrator;
-- ALTER TABLE guests OWNER TO fylista_migrator;
-- ALTER TABLE pro_payments OWNER TO fylista_migrator;
-- ALTER TABLE failed_webhooks OWNER TO fylista_migrator;
-- ALTER TABLE platform_fees OWNER TO fylista_migrator;
-- ALTER TABLE email_tracking OWNER TO fylista_migrator;
-- ALTER TABLE event_views OWNER TO fylista_migrator;
-- ALTER TABLE refresh_tokens OWNER TO fylista_migrator;
-- ALTER TABLE consent_records OWNER TO fylista_migrator;
-- ALTER TABLE arco_requests OWNER TO fylista_migrator;
-- ALTER TABLE audit_logs OWNER TO fylista_migrator;
-- ALTER TABLE migration_journal OWNER TO fylista_migrator;

-- ============================================================
-- 4. REVOCAR privilegios excesivos del rol owner original
-- ============================================================
-- Después de verificar que fylista_app y fylista_migrator funcionan,
-- revocar privilegios del rol postgres/owner original para runtime:
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
-- (No ejecutar hasta verificar que las nuevas conexiones funcionan)

-- ============================================================
-- 5. BYPASSRLS para fylista_migrator (migraciones necesitan acceso total)
-- ============================================================
ALTER ROLE fylista_migrator BYPASSRLS;

-- ============================================================
-- 6. CONFIGURACIÓN POST-DEPLOY
-- ============================================================
-- En Railway, cambiar DATABASE_URL para runtime a:
-- postgresql://fylista_app:NUEVO_PASSWORD@ep-xxx.neon.tech/neondb?sslmode=require
--
-- En drizzle.config.js / migraciones, usar:
-- postgresql://fylista_migrator:NUEVO_PASSWORD@ep-xxx.neon.tech/neondb?sslmode=require
--
-- En Neon Dashboard → Roles → revocar acceso del rol postgres original
-- a las tablas (mantener solo para emergencias admin).
