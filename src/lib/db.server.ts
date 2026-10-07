import pg from "pg";
import { hashPassword } from "./password.server";

let pool: pg.Pool | undefined;
let ready: Promise<void> | undefined;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
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
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS beneficiaries (
  id serial PRIMARY KEY,
  holder_id int NOT NULL REFERENCES holders(id) ON DELETE CASCADE,
  name text NOT NULL,
  cpf text,
  birth_date date,
  relationship text NOT NULL
);
CREATE TABLE IF NOT EXISTS contracts (
  id serial PRIMARY KEY,
  holder_id int NOT NULL REFERENCES holders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  stored_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes int NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS invoices (
  id serial PRIMARY KEY,
  holder_id int NOT NULL REFERENCES holders(id) ON DELETE CASCADE,
  reference_month text NOT NULL,
  amount numeric(10,2) NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'aberta',
  paid_at date,
  payment_method text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (holder_id, reference_month)
);
`;

async function init(p: pg.Pool) {
  await p.query(SCHEMA);
  const { rows } = await p.query("SELECT count(*)::int AS n FROM users");
  if (rows[0].n === 0) {
    const email = process.env["ADMIN_EMAIL"] ?? "admin@admin.com";
    const password = process.env["ADMIN_PASSWORD"] ?? "admin123";
    await p.query("INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3)", [
      "Administrador",
      email.toLowerCase(),
      await hashPassword(password),
    ]);
  }
}

export async function db(): Promise<pg.Pool> {
  if (!pool) {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL não configurada");
    pool = new pg.Pool({
      connectionString: url,
      ssl: process.env["DATABASE_SSL"] === "true" ? { rejectUnauthorized: false } : undefined,
    });
  }
  if (!ready) ready = init(pool).catch((e) => {
    ready = undefined;
    throw e;
  });
  await ready;
  return pool;
}

export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const p = await db();
  const r = await p.query(sql, params);
  return r.rows as T[];
}
