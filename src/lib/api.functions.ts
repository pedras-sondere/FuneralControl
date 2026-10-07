import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const auth = async () => (await import("./auth.server")).requireUser();
const sql = async () => (await import("./db.server")).q;

// ---------- Auth ----------
export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("./auth.server");
  return getSessionUser();
});

export const login = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email(), password: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const q = await sql();
    const { verifyPassword } = await import("./password.server");
    const { createSession } = await import("./auth.server");
    const rows = await q("SELECT id, password_hash FROM users WHERE email = $1", [
      data.email.toLowerCase(),
    ]);
    const u = rows[0];
    if (!u || !(await verifyPassword(data.password, u.password_hash))) {
      return { ok: false as const, error: "E-mail ou senha inválidos" };
    }
    await createSession(u.id);
    return { ok: true as const };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { destroySession } = await import("./auth.server");
  await destroySession();
  return { ok: true };
});

// ---------- Shared SQL ----------
const INVOICE_STATUS = `CASE WHEN i.status = 'aberta' AND i.due_date < current_date THEN 'vencida' ELSE i.status END`;
const HOLDER_STATUS = `CASE WHEN h.status = 'cancelado' THEN 'cancelado'
  WHEN EXISTS (SELECT 1 FROM invoices x WHERE x.holder_id = h.id AND x.status = 'aberta' AND x.due_date < current_date) THEN 'inadimplente'
  ELSE 'ativo' END`;

export type Plan = {
  id: number;
  name: string;
  monthly_price: number;
  max_beneficiaries: number;
  description: string | null;
  active: boolean;
};

// ---------- Dashboard ----------
export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const q = await sql();
  const [s] = await q(`SELECT
    (SELECT count(*)::int FROM holders WHERE status <> 'cancelado') AS active_holders,
    (SELECT count(*)::int FROM invoices WHERE status = 'aberta' AND due_date >= current_date) AS open_invoices,
    (SELECT count(*)::int FROM invoices WHERE status = 'aberta' AND due_date < current_date) AS overdue_invoices,
    (SELECT coalesce(sum(amount),0)::float FROM invoices WHERE status = 'paga' AND date_trunc('month', paid_at) = date_trunc('month', current_date)) AS received_month`);
  const upcoming = await q(`SELECT i.id, h.id AS holder_id, h.name AS holder_name, i.amount::float AS amount,
      i.due_date::text AS due_date, ${INVOICE_STATUS} AS status
    FROM invoices i JOIN holders h ON h.id = i.holder_id
    WHERE i.status = 'aberta' ORDER BY i.due_date LIMIT 8`);
  return { stats: s, upcoming };
});

// ---------- Plans ----------
export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const q = await sql();
  return q<Plan & { holders: number }>(`SELECT p.id, p.name, p.monthly_price::float AS monthly_price,
    p.max_beneficiaries, p.description, p.active,
    (SELECT count(*)::int FROM holders h WHERE h.plan_id = p.id) AS holders
    FROM plans p ORDER BY p.name`);
});

const planSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  monthly_price: z.number().min(0),
  max_beneficiaries: z.number().int().min(0),
  description: z.string().nullable().optional(),
  active: z.boolean(),
});

export const savePlan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => planSchema.parse(d))
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    const vals = [data.name, data.monthly_price, data.max_beneficiaries, data.description ?? null, data.active];
    if (data.id) {
      await q(`UPDATE plans SET name=$1, monthly_price=$2, max_beneficiaries=$3, description=$4, active=$5 WHERE id=$6`, [...vals, data.id]);
    } else {
      await q(`INSERT INTO plans (name, monthly_price, max_beneficiaries, description, active) VALUES ($1,$2,$3,$4,$5)`, vals);
    }
    return { ok: true };
  });

// ---------- Holders ----------
export const listHolders = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ search: z.string().optional(), status: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    const rows = await q(`SELECT * FROM (SELECT h.id, h.name, h.cpf, h.phone, h.due_day, p.name AS plan_name,
        ${HOLDER_STATUS} AS status,
        (SELECT count(*)::int FROM beneficiaries b WHERE b.holder_id = h.id) AS beneficiaries
      FROM holders h JOIN plans p ON p.id = h.plan_id) t
      WHERE ($1::text IS NULL OR t.name ILIKE '%' || $1 || '%' OR regexp_replace(t.cpf, '\\D', '', 'g') LIKE '%' || regexp_replace($1, '\\D', '', 'g') || '%')
        AND ($2::text IS NULL OR t.status = $2)
      ORDER BY t.name`, [data.search?.trim() || null, data.status && data.status !== "todos" ? data.status : null]);
    return rows as Array<{ id: number; name: string; cpf: string; phone: string | null; due_day: number; plan_name: string; status: string; beneficiaries: number }>;
  });

const holderSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  cpf: z.string().min(11),
  birth_date: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  plan_id: z.number(),
  due_day: z.number().int().min(1).max(28),
  join_date: z.string(),
  status: z.enum(["ativo", "cancelado"]),
});

export const saveHolder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => holderSchema.parse(d))
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    const v = [data.name, data.cpf, data.birth_date || null, data.phone || null, data.email || null,
      data.address || null, data.plan_id, data.due_day, data.join_date, data.status];
    try {
      if (data.id) {
        await q(`UPDATE holders SET name=$1, cpf=$2, birth_date=$3, phone=$4, email=$5, address=$6,
          plan_id=$7, due_day=$8, join_date=$9, status=$10 WHERE id=$11`, [...v, data.id]);
        return { ok: true as const, id: data.id };
      }
      const r = await q(`INSERT INTO holders (name, cpf, birth_date, phone, email, address, plan_id, due_day, join_date, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, v);
      return { ok: true as const, id: r[0].id as number };
    } catch (e: any) {
      if (e?.code === "23505") return { ok: false as const, error: "Já existe um titular com este CPF" };
      throw e;
    }
  });

export const getHolder = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.number() }).parse(d))
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    const [holder] = await q(`SELECT h.id, h.name, h.cpf, h.birth_date::text AS birth_date, h.phone, h.email, h.address,
        h.plan_id, h.due_day, h.join_date::text AS join_date, h.status AS base_status, ${HOLDER_STATUS} AS status,
        p.name AS plan_name, p.monthly_price::float AS monthly_price, p.max_beneficiaries
      FROM holders h JOIN plans p ON p.id = h.plan_id WHERE h.id = $1`, [data.id]);
    if (!holder) return null;
    const beneficiaries = await q(`SELECT id, name, cpf, birth_date::text AS birth_date, relationship
      FROM beneficiaries WHERE holder_id = $1 ORDER BY name`, [data.id]);
    const contracts = await q(`SELECT id, file_name, mime_type, size_bytes, uploaded_at::text AS uploaded_at
      FROM contracts WHERE holder_id = $1 ORDER BY uploaded_at DESC`, [data.id]);
    const invoices = await q(`SELECT i.id, i.reference_month, i.amount::float AS amount, i.due_date::text AS due_date,
        ${INVOICE_STATUS} AS status, i.paid_at::text AS paid_at, i.payment_method
      FROM invoices i WHERE i.holder_id = $1 ORDER BY i.due_date DESC`, [data.id]);
    return { holder, beneficiaries, contracts, invoices };
  });

// ---------- Beneficiaries ----------
const benSchema = z.object({
  id: z.number().optional(),
  holder_id: z.number(),
  name: z.string().min(1),
  cpf: z.string().nullable().optional(),
  birth_date: z.string().nullable().optional(),
  relationship: z.string().min(1),
});

export const saveBeneficiary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => benSchema.parse(d))
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    if (data.id) {
      await q(`UPDATE beneficiaries SET name=$1, cpf=$2, birth_date=$3, relationship=$4 WHERE id=$5 AND holder_id=$6`,
        [data.name, data.cpf || null, data.birth_date || null, data.relationship, data.id, data.holder_id]);
      return { ok: true as const };
    }
    const [lim] = await q(`SELECT p.max_beneficiaries AS max,
      (SELECT count(*)::int FROM beneficiaries WHERE holder_id = h.id) AS n
      FROM holders h JOIN plans p ON p.id = h.plan_id WHERE h.id = $1`, [data.holder_id]);
    if (lim && lim.n >= lim.max) {
      return { ok: false as const, error: `O plano permite no máximo ${lim.max} beneficiário(s)` };
    }
    await q(`INSERT INTO beneficiaries (holder_id, name, cpf, birth_date, relationship) VALUES ($1,$2,$3,$4,$5)`,
      [data.holder_id, data.name, data.cpf || null, data.birth_date || null, data.relationship]);
    return { ok: true as const };
  });

export const deleteBeneficiary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.number() }).parse(d))
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    await q("DELETE FROM beneficiaries WHERE id = $1", [data.id]);
    return { ok: true };
  });

// ---------- Contracts ----------
export const uploadContract = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Envio inválido");
    const file = d.get("file");
    const holderId = Number(d.get("holder_id"));
    if (!(file instanceof File) || !holderId) throw new Error("Arquivo inválido");
    return { file, holderId };
  })
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    const { saveFile } = await import("./storage.server");
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(data.file.type)) return { ok: false as const, error: "Envie PDF ou imagem (JPG/PNG)" };
    if (data.file.size > 20 * 1024 * 1024) return { ok: false as const, error: "Arquivo maior que 20 MB" };
    const stored = await saveFile(data.file);
    await q(`INSERT INTO contracts (holder_id, file_name, stored_name, mime_type, size_bytes) VALUES ($1,$2,$3,$4,$5)`,
      [data.holderId, data.file.name, stored, data.file.type, data.file.size]);
    return { ok: true as const };
  });

export const deleteContract = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.number() }).parse(d))
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    const { removeFile } = await import("./storage.server");
    const r = await q("DELETE FROM contracts WHERE id = $1 RETURNING stored_name", [data.id]);
    if (r[0]) await removeFile(r[0].stored_name);
    return { ok: true };
  });

// ---------- Invoices ----------
export const listInvoices = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ status: z.string().optional(), month: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    return q<{ id: number; holder_id: number; holder_name: string; reference_month: string; amount: number; due_date: string; status: string; paid_at: string | null; payment_method: string | null }>(
      `SELECT * FROM (SELECT i.id, h.id AS holder_id, h.name AS holder_name, i.reference_month, i.amount::float AS amount,
        i.due_date::text AS due_date, ${INVOICE_STATUS} AS status, i.paid_at::text AS paid_at, i.payment_method
       FROM invoices i JOIN holders h ON h.id = i.holder_id) t
       WHERE ($1::text IS NULL OR t.status = $1) AND ($2::text IS NULL OR t.reference_month = $2)
       ORDER BY t.due_date DESC, t.holder_name`,
      [data.status && data.status !== "todas" ? data.status : null, data.month || null],
    );
  });

export const generateInvoices = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    const r = await q(`INSERT INTO invoices (holder_id, reference_month, amount, due_date)
      SELECT h.id, $1, p.monthly_price, ($1 || '-01')::date + (h.due_day - 1)
      FROM holders h JOIN plans p ON p.id = h.plan_id
      WHERE h.status <> 'cancelado' AND h.join_date <= (($1 || '-01')::date + interval '1 month' - interval '1 day')
      ON CONFLICT (holder_id, reference_month) DO NOTHING RETURNING id`, [data.month]);
    return { created: r.length };
  });

export const payInvoice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.number(), paid_at: z.string(), payment_method: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    await q(`UPDATE invoices SET status='paga', paid_at=$1, payment_method=$2 WHERE id=$3`,
      [data.paid_at, data.payment_method, data.id]);
    return { ok: true };
  });

export const setInvoiceStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.number(), status: z.enum(["aberta", "cancelada"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    await q(`UPDATE invoices SET status=$1, paid_at=NULL, payment_method=NULL WHERE id=$2`, [data.status, data.id]);
    return { ok: true };
  });
