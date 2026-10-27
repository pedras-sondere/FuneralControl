import pg from "pg";
import { hashPassword } from "./password.server";
import { readDatabaseConfig, readInitialAdminConfig } from "./runtime-config.server";
import { assertSchemaCompatibility, CURRENT_SCHEMA_VERSION } from "./schema-version";

let client: pg.Pool | undefined;
let ready: Promise<void> | undefined;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
  id serial PRIMARY KEY,
  name text NOT NULL,
  monthly_price numeric(10,2) NOT NULL,
  max_beneficiaries int NOT NULL DEFAULT 0,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS holders (
  id serial PRIMARY KEY,
  name text NOT NULL,
  cpf text NOT NULL UNIQUE,
  birth_date date,
  phone text,
  email text,
  address text,
  plan_id int NOT NULL REFERENCES plans(id),
  due_day int NOT NULL CHECK (due_day BETWEEN 1 AND 28),
  join_date date NOT NULL DEFAULT current_date,
  monthly_billing_date date,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'falecido', 'cancelado')),
  status_changed_at date,
  current_holder_beneficiary_id int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS beneficiaries (
  id serial PRIMARY KEY,
  holder_id int NOT NULL REFERENCES holders(id) ON DELETE CASCADE,
  name text NOT NULL,
  cpf text,
  birth_date date,
  relationship text NOT NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'falecido', 'cancelado')),
  status_changed_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS beneficiaries_cpf_unique
  ON beneficiaries (cpf) WHERE cpf IS NOT NULL;
CREATE TABLE IF NOT EXISTS contracts (
  id serial PRIMARY KEY,
  holder_id int NOT NULL REFERENCES holders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  stored_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes int NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS family_events (
  id serial PRIMARY KEY,
  holder_id int NOT NULL REFERENCES holders(id) ON DELETE CASCADE,
  beneficiary_id int REFERENCES beneficiaries(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('inadimplencia', 'cancelamento', 'falecimento', 'utilizacao', 'observacao', 'outro', 'renovacao')),
  occurred_on date NOT NULL,
  description text NOT NULL DEFAULT '',
  created_by int REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS family_events_holder_occurred_on_idx
  ON family_events (holder_id, occurred_on DESC, id DESC);
CREATE TABLE IF NOT EXISTS holder_successions (
  id serial PRIMARY KEY,
  holder_id int NOT NULL REFERENCES holders(id) ON DELETE CASCADE,
  beneficiary_id int NOT NULL REFERENCES beneficiaries(id) ON DELETE RESTRICT,
  previous_beneficiary_id int REFERENCES beneficiaries(id) ON DELETE SET NULL,
  occurred_on date NOT NULL,
  created_by int REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS renewal_completions (
  id serial PRIMARY KEY,
  holder_id int NOT NULL REFERENCES holders(id) ON DELETE CASCADE,
  reference_date date NOT NULL,
  completed_by int REFERENCES users(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (holder_id, reference_date)
);
CREATE TABLE IF NOT EXISTS backup_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  local_backup_dir text,
  cloud_backup_dir text,
  external_backup_dir text,
  external_last_success_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS backup_runs (
  id serial PRIMARY KEY,
  destination text NOT NULL CHECK (destination IN ('local', 'nuvem', 'externo')),
  status text NOT NULL CHECK (status IN ('sucesso', 'falha')),
  archive_path text,
  archive_sha256 text,
  message text,
  initiated_by int REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS schema_migrations (
  version int PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
`;

const MANAGEMENT_SCHEMA = `
ALTER TABLE holders ADD COLUMN IF NOT EXISTS monthly_billing_date date;
ALTER TABLE holders ADD COLUMN IF NOT EXISTS status_changed_at date;
ALTER TABLE holders ADD COLUMN IF NOT EXISTS current_holder_beneficiary_id int;
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo';
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS status_changed_at date;
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS family_events (
  id serial PRIMARY KEY,
  holder_id int NOT NULL REFERENCES holders(id) ON DELETE CASCADE,
  beneficiary_id int REFERENCES beneficiaries(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('inadimplencia', 'cancelamento', 'falecimento', 'utilizacao', 'observacao', 'outro', 'renovacao')),
  occurred_on date NOT NULL,
  description text NOT NULL DEFAULT '',
  created_by int REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS family_events_holder_occurred_on_idx
  ON family_events (holder_id, occurred_on DESC, id DESC);
CREATE TABLE IF NOT EXISTS holder_successions (
  id serial PRIMARY KEY,
  holder_id int NOT NULL REFERENCES holders(id) ON DELETE CASCADE,
  beneficiary_id int NOT NULL REFERENCES beneficiaries(id) ON DELETE RESTRICT,
  previous_beneficiary_id int REFERENCES beneficiaries(id) ON DELETE SET NULL,
  occurred_on date NOT NULL,
  created_by int REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS renewal_completions (
  id serial PRIMARY KEY,
  holder_id int NOT NULL REFERENCES holders(id) ON DELETE CASCADE,
  reference_date date NOT NULL,
  completed_by int REFERENCES users(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (holder_id, reference_date)
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'holders_current_holder_beneficiary_fk'
  ) THEN
    ALTER TABLE holders
      ADD CONSTRAINT holders_current_holder_beneficiary_fk
      FOREIGN KEY (current_holder_beneficiary_id) REFERENCES beneficiaries(id) ON DELETE RESTRICT;
  END IF;
END $$;
`;

// A versão 3 encerra definitivamente o módulo legado de faturas. A atualização
// é executada somente com a migração autorizada pelo inicializador local.
const INVOICE_RETIREMENT_SCHEMA = `DROP TABLE IF EXISTS invoices;`;

async function init(dbClient: pg.Pool) {
  if (process.env["FUNERALCONTROL_ALLOW_SCHEMA_MIGRATION"] !== "true") {
    const { rows } = await dbClient
      .query<{ version: number }>("SELECT max(version)::int AS version FROM schema_migrations")
      .catch(() => {
        throw new Error("O esquema do banco não foi preparado para este runtime local.");
      });
    const compatibility = assertSchemaCompatibility({ installed: Number(rows[0]?.version ?? 0) });
    if (!compatibility.ok) throw new Error(compatibility.reason);
  } else {
    await dbClient.query(SCHEMA);
    await dbClient.query(MANAGEMENT_SCHEMA);
    await dbClient.query(INVOICE_RETIREMENT_SCHEMA);
    await dbClient.query(
      "ALTER TABLE backup_settings ADD COLUMN IF NOT EXISTS local_backup_dir text",
    );
    await dbClient.query(
      "INSERT INTO backup_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING",
    );
    await dbClient.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false",
    );
    await dbClient.query(
      "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
      [CURRENT_SCHEMA_VERSION],
    );
  }

  // Cria usuário administrador inicial se não existir.
  const { rows } = await dbClient.query("SELECT count(*)::int AS n FROM users");
  if (Number(rows[0]?.n || 0) === 0) {
    const { email, password } = readInitialAdminConfig(process.env);
    await dbClient.query(
      "INSERT INTO users (name, email, password_hash, must_change_password) VALUES ($1,$2,$3,true)",
      ["Administrador", email.toLowerCase(), await hashPassword(password)],
    );
    console.log("[Banco de Dados] Usuário administrador inicial criado.");
  }

  // Cria planos padrão se o banco estiver vazio
  const planRows = await dbClient.query("SELECT count(*)::int AS n FROM plans");
  if (Number(planRows.rows?.[0]?.n || planRows[0]?.n || 0) === 0) {
    await dbClient.query(`
      INSERT INTO plans (name, monthly_price, max_beneficiaries, description, active) VALUES
      ('Plano Individual Essencial', 35.00, 0, 'Cobertura funeral completa individual com assistência 24h', true),
      ('Plano Familiar Prata', 65.00, 3, 'Cobertura funeral para o titular e até 3 dependentes diretos', true),
      ('Plano Familiar Ouro', 95.00, 6, 'Cobertura funeral ampla para o titular e até 6 dependentes', true)
    `);
    console.log("[Banco de Dados] Planos iniciais cadastrados com sucesso.");
  }
}

export async function db() {
  if (!client) {
    const config = readDatabaseConfig(process.env);
    const pool = new pg.Pool({ ...config, connectionTimeoutMillis: 1500 });
    try {
      await pool.query("SELECT 1");
    } catch (error) {
      await pool.end().catch(() => undefined);
      throw new Error(
        "Não foi possível conectar ao PostgreSQL. Verifique se o serviço está ativo e se DATABASE_URL está correta.",
        { cause: error },
      );
    }
    client = pool;
    console.log("[Banco de Dados] Conectado ao servidor PostgreSQL.");
  }

  if (!ready) {
    ready = init(client).catch((e) => {
      ready = undefined;
      throw e;
    });
  }
  await ready;
  return client;
}

export async function q<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const p = await db();
  const r = await p.query(sql, params);
  return r.rows as T[];
}
