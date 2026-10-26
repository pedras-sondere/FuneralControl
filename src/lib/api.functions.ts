import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { detectAllowedFileType } from "./file-signature";
import { isValidCpf, normalizeCpf } from "./cpf";
import { canAddBeneficiary, canUsePlanForHolder } from "./business-rules";
import { errorCode, errorMessage } from "./error-message";
import { canAssumeCurrentHolder, getRenewalReminder, isLifecycleStatus } from "./lifecycle-rules";

const auth = async () => (await import("./auth.server")).requireMutableUser();
const sql = async () => (await import("./db.server")).q;
const assertMutable = async () => (await import("./backup-guard.server")).requireMutableOperation();
const cpfSchema = z.string().refine(isValidCpf, "CPF inválido").transform(normalizeCpf);

// ---------- Auth ----------
export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getSessionUser } = await import("./auth.server");
    return await getSessionUser();
  } catch (e) {
    console.warn("Aviso ao buscar usuário da sessão:", e);
    return null;
  }
});

export const login = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ email: z.string().trim().min(1), password: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const q = await sql();
      const { verifyPassword } = await import("./password.server");
      const { createSession } = await import("./auth.server");
      const rows = await q(
        "SELECT id, password_hash, must_change_password FROM users WHERE email = $1",
        [data.email.toLowerCase()],
      );
      const u = rows[0];
      if (!u || !(await verifyPassword(data.password, u.password_hash))) {
        return { ok: false as const, error: "E-mail ou senha inválidos" };
      }
      await createSession(u.id);
      return { ok: true as const, mustChangePassword: Boolean(u.must_change_password) };
    } catch (err: unknown) {
      console.error("Erro no login:", err);
      const message = errorMessage(err, "Erro interno ao processar login");
      const isConnError =
        message.includes("connect") ||
        errorCode(err) === "ECONNREFUSED" ||
        message.includes("DATABASE_URL");
      return {
        ok: false as const,
        error: isConnError
          ? "Não foi possível conectar ao banco de dados PostgreSQL. Verifique se o serviço está ativo ou confira o DATABASE_URL no arquivo .env."
          : message,
      };
    }
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { destroySession } = await import("./auth.server");
  await destroySession();
  return { ok: true };
});

export const changePassword = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { changeOwnPassword } = await import("./auth.server");
    return changeOwnPassword(data);
  });

type BackupDestination = "local" | "nuvem" | "externo";
type AutomaticBackupSummary = {
  completed: boolean;
  succeeded: BackupDestination[];
  failed: BackupDestination[];
  notConfigured: BackupDestination[];
};

async function runConfiguredBackups({
  userId,
  onlyDestinations,
}: {
  userId: number;
  onlyDestinations?: BackupDestination[];
}) {
  const q = await sql();
  const [settings] = await q<{
    local_backup_dir: string | null;
    cloud_backup_dir: string | null;
    external_backup_dir: string | null;
  }>(
    "SELECT local_backup_dir, cloud_backup_dir, external_backup_dir FROM backup_settings WHERE id=true",
  );
  const { getConfiguredBackupDestinations, summarizeBackupRuns } =
    await import("./backup-orchestrator.server");
  const configuration = getConfiguredBackupDestinations({
    localBackupDirectory: settings?.local_backup_dir ?? null,
    cloudBackupDirectory: settings?.cloud_backup_dir ?? null,
    externalBackupDirectory: settings?.external_backup_dir ?? null,
  });
  const selected = onlyDestinations
    ? configuration.destinations.filter((entry) => onlyDestinations.includes(entry.destination))
    : configuration.destinations;
  const notConfigured = onlyDestinations
    ? configuration.notConfigured.filter((destination) => onlyDestinations.includes(destination))
    : configuration.notConfigured;

  let results: Array<{
    destination: BackupDestination;
    status: "sucesso" | "falha";
    archivePath?: string;
    message?: string;
  }> = [];
  let sourceDirectory: string | undefined;
  try {
    if (selected.length > 0) {
      const { cp, mkdir, mkdtemp, rm, writeFile } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const path = await import("node:path");
      const { getUploadDirectory } = await import("./storage.server");
      const { runBackup } = await import("./backup-service.server");
      sourceDirectory = await mkdtemp(path.join(tmpdir(), "funeral-control-backup-source-"));
      try {
        await mkdir(path.join(sourceDirectory, "uploads"), { recursive: true });
        await cp(getUploadDirectory(), path.join(sourceDirectory, "uploads"), {
          recursive: true,
          force: true,
        }).catch(() => undefined);
        await writeFile(
          path.join(sourceDirectory, "configuracao.json"),
          JSON.stringify({ generatedAt: new Date().toISOString(), application: "FuneralControl" }),
        );
        results = await runBackup({ sourceDirectory, destinations: selected });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Não foi possível preparar o backup.";
        results = selected.map(({ destination }) => ({ destination, status: "falha", message }));
      } finally {
        if (sourceDirectory) await rm(sourceDirectory, { recursive: true, force: true });
      }
    }
  } finally {
    for (const result of results) {
      await q(
        `INSERT INTO backup_runs (destination, status, archive_path, message, initiated_by, completed_at)
         VALUES ($1,$2,$3,$4,$5,now())`,
        [
          result.destination,
          result.status,
          result.archivePath ?? null,
          result.message ?? null,
          userId,
        ],
      );
    }
    if (results.some((result) => result.destination === "externo" && result.status === "sucesso")) {
      await q(
        "UPDATE backup_settings SET external_last_success_at=now(), updated_at=now() WHERE id=true",
      );
    }
  }

  return {
    ...summarizeBackupRuns({ results, notConfigured }),
    results,
  };
}

export const logoutWithBackup = createServerFn({ method: "POST" }).handler(async () => {
  const user = await auth();
  let backup: AutomaticBackupSummary = {
    completed: false,
    succeeded: [],
    failed: [],
    notConfigured: [],
  };
  try {
    const result = await runConfiguredBackups({ userId: user.id });
    backup = {
      completed: result.completed,
      succeeded: result.succeeded,
      failed: result.failed,
      notConfigured: result.notConfigured,
    };
  } catch (error) {
    console.error("Não foi possível executar os backups de encerramento:", error);
    backup.failed = ["local", "nuvem", "externo"];
  } finally {
    const { destroySession } = await import("./auth.server");
    await destroySession();
  }
  return { ok: true as const, backup };
});

export const checkForUpdate = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const { APP_VERSION } = await import("./app-version");
  const { getAvailableRelease } = await import("./github-releases.server");
  return getAvailableRelease(APP_VERSION);
});

const updateRequestSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Versão de atualização inválida."),
});

export const startUpdate = createServerFn({ method: "POST" })
  .validator((data: unknown) => updateRequestSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await auth();
    const { APP_VERSION } = await import("./app-version");
    const { getAvailableRelease } = await import("./github-releases.server");
    const release = await getAvailableRelease(APP_VERSION);
    if (!release || release.version !== data.version) {
      return {
        ok: false as const,
        error: "A versão solicitada não está disponível no GitHub Releases.",
      };
    }

    const { getInstalledApplicationRoot, getInstalledDataRoot, buildElevatedUpdateCommand } =
      await import("./update-trigger.server");
    const installRoot = getInstalledApplicationRoot(process.env);
    const dataRoot = getInstalledDataRoot(process.env);
    if (!installRoot || !dataRoot) {
      return {
        ok: false as const,
        error:
          "A atualização automática estará disponível após a instalação do FuneralControl pelo atalho do Windows.",
      };
    }

    const path = await import("node:path");
    const { access } = await import("node:fs/promises");
    const scriptPath = path.join(installRoot, "bootstrap", "Update-FuneralControlV2.ps1");
    try {
      await access(scriptPath);
    } catch {
      return {
        ok: false as const,
        error: "O atualizador local não foi encontrado. Reinstale o FuneralControl.",
      };
    }

    const backup = await runConfiguredBackups({
      userId: user.id,
      onlyDestinations: ["local"],
    });
    if (!backup.completed) {
      return {
        ok: false as const,
        error:
          "A atualização exige uma cópia local validada. Configure a pasta local de backup e tente novamente.",
      };
    }

    const { spawn } = await import("node:child_process");
    const updateProcess = spawn(
      "powershell.exe",
      buildElevatedUpdateCommand({
        installRoot,
        dataRoot,
        version: release.version,
        size: release.size,
        packageUrl: release.packageUrl,
        sha256: release.sha256,
      }),
      { detached: true, stdio: "ignore", windowsHide: true },
    );
    updateProcess.unref();
    setTimeout(() => process.exit(0), 2_000).unref();
    return { ok: true as const };
  });

export const getBackupStatus = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const q = await sql();
  const [settings] = await q<{
    local_backup_dir: string | null;
    cloud_backup_dir: string | null;
    external_backup_dir: string | null;
    external_last_success_at: string | null;
  }>(
    `SELECT local_backup_dir, cloud_backup_dir, external_backup_dir, external_last_success_at::text FROM backup_settings WHERE id = true`,
  );
  const history = await q<{
    id: number;
    destination: "local" | "nuvem" | "externo";
    status: "sucesso" | "falha";
    message: string | null;
    completed_at: string | null;
  }>(
    `SELECT id, destination, status, message, completed_at::text FROM backup_runs ORDER BY created_at DESC LIMIT 20`,
  );
  const { buildBackupStatus } = await import("./backup-status");
  const cloudLastRun = history.find((run) => run.destination === "nuvem")?.status ?? null;
  const overview = buildBackupStatus({
    externalLastSuccess: settings?.external_last_success_at
      ? new Date(settings.external_last_success_at)
      : null,
    cloudLastRunStatus: cloudLastRun,
  });
  return { settings: settings ?? null, history, overview };
});

export const saveBackupSettings = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        localBackupDirectory: z.string().trim().nullable(),
        cloudBackupDirectory: z.string().trim().nullable(),
        externalBackupDirectory: z.string().trim().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    await q(
      `UPDATE backup_settings SET local_backup_dir=$1, cloud_backup_dir=$2, external_backup_dir=$3, updated_at=now() WHERE id=true`,
      [
        data.localBackupDirectory || null,
        data.cloudBackupDirectory || null,
        data.externalBackupDirectory || null,
      ],
    );
    return { ok: true as const };
  });

export const runExternalBackup = createServerFn({ method: "POST" }).handler(async () => {
  const user = await auth();
  const backup = await runConfiguredBackups({
    userId: user.id,
    onlyDestinations: ["externo"],
  });
  if (backup.notConfigured.includes("externo")) {
    return {
      ok: false as const,
      error: "Informe a pasta do HD externo antes de realizar o backup.",
    };
  }
  const failure = backup.results.find((result) => result.status === "falha");
  if (failure) {
    return {
      ok: false as const,
      error: failure.message ?? "Não foi possível concluir o backup no HD externo.",
    };
  }
  return { ok: true as const };
});

// ---------- Shared SQL ----------
const INVOICE_STATUS = `CASE WHEN i.status = 'aberta' AND i.due_date < current_date THEN 'vencida' ELSE i.status END`;
const HOLDER_STATUS = `CASE WHEN h.status = 'falecido' THEN 'falecido'
  WHEN h.status = 'cancelado' THEN 'cancelado'
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
  const upcoming =
    await q(`SELECT i.id, h.id AS holder_id, h.name AS holder_name, i.amount::float AS amount,
      i.due_date::text AS due_date, ${INVOICE_STATUS} AS status
    FROM invoices i JOIN holders h ON h.id = i.holder_id
    WHERE i.status = 'aberta' ORDER BY i.due_date LIMIT 8`);
  return { stats: s, upcoming };
});

// ---------- Plans ----------
export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const q = await sql();
  return q<
    Plan & { holders: number }
  >(`SELECT p.id, p.name, p.monthly_price::float AS monthly_price,
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
  .validator((d: unknown) => planSchema.parse(d))
  .handler(async ({ data }) => {
    await auth();
    await assertMutable();
    const q = await sql();
    const vals = [
      data.name,
      data.monthly_price,
      data.max_beneficiaries,
      data.description ?? null,
      data.active,
    ];
    if (data.id) {
      await q(
        `UPDATE plans SET name=$1, monthly_price=$2, max_beneficiaries=$3, description=$4, active=$5 WHERE id=$6`,
        [...vals, data.id],
      );
    } else {
      await q(
        `INSERT INTO plans (name, monthly_price, max_beneficiaries, description, active) VALUES ($1,$2,$3,$4,$5)`,
        vals,
      );
    }
    return { ok: true };
  });

// ---------- Holders ----------
export const listHolders = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z.object({ search: z.string().optional(), status: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    const rows = await q(
      `SELECT * FROM (SELECT h.id, h.name, h.cpf, h.phone, h.due_day, p.name AS plan_name,
        current_beneficiary.name AS current_holder_name,
        ${HOLDER_STATUS} AS status,
        (SELECT count(*)::int FROM beneficiaries b WHERE b.holder_id = h.id AND b.status = 'ativo') AS beneficiaries
      FROM holders h
      JOIN plans p ON p.id = h.plan_id
      LEFT JOIN beneficiaries current_beneficiary ON current_beneficiary.id = h.current_holder_beneficiary_id) t
      WHERE ($1::text IS NULL OR t.name ILIKE '%' || $1 || '%' OR regexp_replace(t.cpf, '\\D', '', 'g') LIKE '%' || regexp_replace($1, '\\D', '', 'g') || '%'
        OR EXISTS (
          SELECT 1 FROM beneficiaries b
          WHERE b.holder_id = t.id
            AND (b.name ILIKE '%' || $1 || '%' OR regexp_replace(coalesce(b.cpf, ''), '\\D', '', 'g') LIKE '%' || regexp_replace($1, '\\D', '', 'g') || '%')
        ))
        AND ($2::text IS NULL OR t.status = $2)
      ORDER BY t.name`,
      [data.search?.trim() || null, data.status && data.status !== "todos" ? data.status : null],
    );
    return rows as Array<{
      id: number;
      name: string;
      cpf: string;
      phone: string | null;
      due_day: number;
      plan_name: string;
      current_holder_name: string | null;
      status: string;
      beneficiaries: number;
    }>;
  });

const holderSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  cpf: cpfSchema,
  birth_date: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  plan_id: z.number(),
  due_day: z.number().int().min(1).max(28),
  join_date: z.string(),
  monthly_billing_date: z.string().nullable().optional(),
  status: z.enum(["ativo", "falecido", "cancelado"]),
});

export const saveHolder = createServerFn({ method: "POST" })
  .validator((d: unknown) => holderSchema.parse(d))
  .handler(async ({ data }) => {
    await auth();
    await assertMutable();
    const q = await sql();
    const [plan] = await q<{ active: boolean }>("SELECT active FROM plans WHERE id = $1", [
      data.plan_id,
    ]);
    const [existing] = data.id
      ? await q<{ plan_id: number }>("SELECT plan_id FROM holders WHERE id = $1", [data.id])
      : [undefined];
    if (!canUsePlanForHolder(plan) && (!data.id || existing?.plan_id !== data.plan_id)) {
      return {
        ok: false as const,
        error: "Não é possível atribuir um plano inativo a um titular.",
      };
    }
    const v = [
      data.name,
      data.cpf,
      data.birth_date || null,
      data.phone || null,
      data.email || null,
      data.address || null,
      data.plan_id,
      data.due_day,
      data.join_date,
      data.monthly_billing_date || null,
      data.status,
    ];
    try {
      if (data.id) {
        await q(
          `UPDATE holders SET name=$1, cpf=$2, birth_date=$3, phone=$4, email=$5, address=$6,
          plan_id=$7, due_day=$8, join_date=$9, monthly_billing_date=$10, status=$11,
          status_changed_at = CASE WHEN status IS DISTINCT FROM $11 THEN current_date ELSE status_changed_at END WHERE id=$12`,
          [...v, data.id],
        );
        return { ok: true as const, id: data.id };
      }
      const r = await q(
        `INSERT INTO holders (name, cpf, birth_date, phone, email, address, plan_id, due_day, join_date, monthly_billing_date, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        v,
      );
      return { ok: true as const, id: r[0].id as number };
    } catch (e: unknown) {
      if (errorCode(e) === "23505")
        return { ok: false as const, error: "Já existe um titular com este CPF" };
      throw e;
    }
  });

export const getHolder = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ id: z.number() }).parse(d))
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    const [holder] = await q(
      `SELECT h.id, h.name, h.cpf, h.birth_date::text AS birth_date, h.phone, h.email, h.address,
        h.plan_id, h.due_day, h.join_date::text AS join_date, h.monthly_billing_date::text AS monthly_billing_date,
        h.status AS base_status, h.status_changed_at::text AS status_changed_at, h.current_holder_beneficiary_id,
        ${HOLDER_STATUS} AS status,
        current_beneficiary.name AS current_holder_name,
        p.name AS plan_name, p.monthly_price::float AS monthly_price, p.max_beneficiaries
      FROM holders h
      JOIN plans p ON p.id = h.plan_id
      LEFT JOIN beneficiaries current_beneficiary ON current_beneficiary.id = h.current_holder_beneficiary_id
      WHERE h.id = $1`,
      [data.id],
    );
    if (!holder) return null;
    const beneficiaries = await q(
      `SELECT id, name, cpf, birth_date::text AS birth_date, relationship, status,
        status_changed_at::text AS status_changed_at,
        (id = $2) AS is_current_holder
      FROM beneficiaries WHERE holder_id = $1 ORDER BY name`,
      [data.id, holder.current_holder_beneficiary_id],
    );
    const contracts = await q(
      `SELECT id, file_name, mime_type, size_bytes, uploaded_at::text AS uploaded_at
      FROM contracts WHERE holder_id = $1 ORDER BY uploaded_at DESC`,
      [data.id],
    );
    const invoices = await q(
      `SELECT i.id, i.reference_month, i.amount::float AS amount, i.due_date::text AS due_date,
        ${INVOICE_STATUS} AS status, i.paid_at::text AS paid_at, i.payment_method
      FROM invoices i WHERE i.holder_id = $1 ORDER BY i.due_date DESC`,
      [data.id],
    );
    const events = await q(
      `SELECT e.id, e.event_type, e.occurred_on::text AS occurred_on, e.description,
        b.name AS beneficiary_name, u.name AS created_by_name, e.created_at::text AS created_at
      FROM family_events e
      LEFT JOIN beneficiaries b ON b.id = e.beneficiary_id
      LEFT JOIN users u ON u.id = e.created_by
      WHERE e.holder_id = $1
      ORDER BY e.occurred_on DESC, e.id DESC`,
      [data.id],
    );
    return { holder, beneficiaries, contracts, invoices, events };
  });

// ---------- Beneficiaries ----------
const benSchema = z.object({
  id: z.number().optional(),
  holder_id: z.number(),
  name: z.string().min(1),
  cpf: cpfSchema.nullable().optional(),
  birth_date: z.string().nullable().optional(),
  relationship: z.string().min(1),
});

export const saveBeneficiary = createServerFn({ method: "POST" })
  .validator((d: unknown) => benSchema.parse(d))
  .handler(async ({ data }) => {
    await auth();
    await assertMutable();
    const q = await sql();
    if (data.id) {
      await q(
        `UPDATE beneficiaries SET name=$1, cpf=$2, birth_date=$3, relationship=$4 WHERE id=$5 AND holder_id=$6`,
        [
          data.name,
          data.cpf || null,
          data.birth_date || null,
          data.relationship,
          data.id,
          data.holder_id,
        ],
      );
      return { ok: true as const };
    }
    const [lim] = await q(
      `SELECT p.max_beneficiaries AS max,
      (SELECT count(*)::int FROM beneficiaries WHERE holder_id = h.id AND status = 'ativo') AS n
      FROM holders h JOIN plans p ON p.id = h.plan_id WHERE h.id = $1`,
      [data.holder_id],
    );
    if (lim && !canAddBeneficiary(lim.n, lim.max)) {
      return { ok: false as const, error: `O plano permite no máximo ${lim.max} beneficiário(s)` };
    }
    await q(
      `INSERT INTO beneficiaries (holder_id, name, cpf, birth_date, relationship) VALUES ($1,$2,$3,$4,$5)`,
      [data.holder_id, data.name, data.cpf || null, data.birth_date || null, data.relationship],
    );
    return { ok: true as const };
  });

export const deleteBeneficiary = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.number() }).parse(d))
  .handler(async ({ data }) => {
    const user = await auth();
    await assertMutable();
    const q = await sql();
    const [beneficiary] = await q<{ holder_id: number; name: string }>(
      "SELECT holder_id, name FROM beneficiaries WHERE id = $1",
      [data.id],
    );
    if (!beneficiary) return { ok: false as const, error: "Beneficiário não encontrado." };
    await q(
      "UPDATE beneficiaries SET status = 'cancelado', status_changed_at = current_date WHERE id = $1",
      [data.id],
    );
    await q(
      `INSERT INTO family_events (holder_id, beneficiary_id, event_type, occurred_on, description, created_by)
      VALUES ($1,$2,'cancelamento',current_date,$3,$4)`,
      [
        beneficiary.holder_id,
        data.id,
        `Beneficiário ${beneficiary.name} marcado como cancelado.`,
        user.id,
      ],
    );
    return { ok: true as const };
  });

const occurrenceSchema = z.object({
  holder_id: z.number(),
  beneficiary_id: z.number().nullable().optional(),
  event_type: z.enum([
    "inadimplencia",
    "cancelamento",
    "falecimento",
    "utilizacao",
    "observacao",
    "outro",
  ]),
  occurred_on: z.string().min(1),
  description: z.string().trim().min(1),
});

export const recordFamilyOccurrence = createServerFn({ method: "POST" })
  .validator((d: unknown) => occurrenceSchema.parse(d))
  .handler(async ({ data }) => {
    const user = await auth();
    await assertMutable();
    const q = await sql();
    if (data.beneficiary_id) {
      const [beneficiary] = await q<{ id: number }>(
        "SELECT id FROM beneficiaries WHERE id = $1 AND holder_id = $2",
        [data.beneficiary_id, data.holder_id],
      );
      if (!beneficiary)
        return { ok: false as const, error: "Beneficiário não pertence a esta família." };
    }
    await q(
      `INSERT INTO family_events (holder_id, beneficiary_id, event_type, occurred_on, description, created_by)
      VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        data.holder_id,
        data.beneficiary_id || null,
        data.event_type,
        data.occurred_on,
        data.description,
        user.id,
      ],
    );
    return { ok: true as const };
  });

const lifecycleSchema = z.object({
  holder_id: z.number(),
  subject: z.enum(["titular", "beneficiario"]),
  beneficiary_id: z.number().nullable().optional(),
  status: z.enum(["falecido", "cancelado"]),
  occurred_on: z.string().min(1),
  description: z.string().trim().optional(),
  successor_beneficiary_id: z.number().nullable().optional(),
});

export const recordPersonLifecycle = createServerFn({ method: "POST" })
  .validator((d: unknown) => lifecycleSchema.parse(d))
  .handler(async ({ data }) => {
    const user = await auth();
    await assertMutable();
    const q = await sql();
    const [holder] = await q<{ status: string; current_holder_beneficiary_id: number | null }>(
      "SELECT status, current_holder_beneficiary_id FROM holders WHERE id = $1",
      [data.holder_id],
    );
    if (!holder) return { ok: false as const, error: "Cadastro familiar não encontrado." };

    const personIsHolder = data.subject === "titular";
    if (!personIsHolder && !data.beneficiary_id) {
      return { ok: false as const, error: "Selecione o beneficiário." };
    }

    if (data.successor_beneficiary_id) {
      if (data.status !== "falecido") {
        return {
          ok: false as const,
          error: "A titularidade só pode ser transferida após um falecimento.",
        };
      }
      const [successor] = await q<{ status: string }>(
        "SELECT status FROM beneficiaries WHERE id = $1 AND holder_id = $2",
        [data.successor_beneficiary_id, data.holder_id],
      );
      if (
        !successor ||
        !isLifecycleStatus(successor.status) ||
        !canAssumeCurrentHolder("falecido", successor.status)
      ) {
        return {
          ok: false as const,
          error: "O titular atual deve ser um beneficiário ativo desta família.",
        };
      }
    }

    if (personIsHolder) {
      await q("UPDATE holders SET status = $1, status_changed_at = $2 WHERE id = $3", [
        data.status,
        data.occurred_on,
        data.holder_id,
      ]);
      if (data.successor_beneficiary_id) {
        await q("UPDATE holders SET current_holder_beneficiary_id = $1 WHERE id = $2", [
          data.successor_beneficiary_id,
          data.holder_id,
        ]);
        await q(
          `INSERT INTO holder_successions (holder_id, beneficiary_id, previous_beneficiary_id, occurred_on, created_by)
          VALUES ($1,$2,$3,$4,$5)`,
          [
            data.holder_id,
            data.successor_beneficiary_id,
            holder.current_holder_beneficiary_id,
            data.occurred_on,
            user.id,
          ],
        );
      }
    } else {
      const [beneficiary] = await q<{ id: number; name: string }>(
        "SELECT id, name FROM beneficiaries WHERE id = $1 AND holder_id = $2",
        [data.beneficiary_id, data.holder_id],
      );
      if (!beneficiary)
        return { ok: false as const, error: "Beneficiário não pertence a esta família." };
      await q("UPDATE beneficiaries SET status = $1, status_changed_at = $2 WHERE id = $3", [
        data.status,
        data.occurred_on,
        data.beneficiary_id,
      ]);
    }

    const subjectLabel = personIsHolder ? "Titular original" : "Beneficiário";
    await q(
      `INSERT INTO family_events (holder_id, beneficiary_id, event_type, occurred_on, description, created_by)
      VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        data.holder_id,
        personIsHolder ? null : data.beneficiary_id || null,
        data.status === "falecido" ? "falecimento" : "cancelamento",
        data.occurred_on,
        data.description || `${subjectLabel} marcado como ${data.status}.`,
        user.id,
      ],
    );
    return { ok: true as const };
  });

// ---------- Gestão de renovações e utilização ----------
export const getManagementOverview = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const q = await sql();
  const rows = await q<{
    id: number;
    name: string;
    plan_name: string;
    monthly_price: number;
    base_status: string;
    current_holder_name: string | null;
    monthly_billing_date: string | null;
    latest_completed_reference_date: string | null;
    death_count: number;
    utilization_count: number;
  }>(
    `SELECT h.id, h.name, h.status AS base_status, h.monthly_billing_date::text AS monthly_billing_date,
      p.name AS plan_name, p.monthly_price::float AS monthly_price,
      current_beneficiary.name AS current_holder_name,
      (SELECT max(reference_date)::text FROM renewal_completions r WHERE r.holder_id = h.id) AS latest_completed_reference_date,
      (SELECT count(*)::int FROM family_events e WHERE e.holder_id = h.id AND e.event_type = 'falecimento') AS death_count,
      (SELECT count(*)::int FROM family_events e WHERE e.holder_id = h.id AND e.event_type = 'utilizacao') AS utilization_count
    FROM holders h
    JOIN plans p ON p.id = h.plan_id
    LEFT JOIN beneficiaries current_beneficiary ON current_beneficiary.id = h.current_holder_beneficiary_id
    ORDER BY h.name`,
  );
  const today = new Date().toISOString().slice(0, 10);
  const families = rows.map((row) => ({
    ...row,
    renewal: getRenewalReminder({
      monthlyBillingDate: row.monthly_billing_date,
      latestCompletedReferenceDate: row.latest_completed_reference_date,
      today,
    }),
  }));
  const activeFamilies = families.filter(
    (family) => family.base_status === "ativo" || Boolean(family.current_holder_name),
  );
  const monthlyRevenueEstimate = activeFamilies.reduce(
    (total, family) => total + Number(family.monthly_price || 0),
    0,
  );
  const deaths = families.reduce((total, family) => total + Number(family.death_count || 0), 0);
  const utilizations = families.reduce(
    (total, family) => total + Number(family.utilization_count || 0),
    0,
  );
  const recentOccurrences = await q<{
    id: number;
    holder_id: number;
    holder_name: string;
    beneficiary_name: string | null;
    event_type: string;
    occurred_on: string;
    description: string;
  }>(
    `SELECT e.id, e.holder_id, h.name AS holder_name, b.name AS beneficiary_name,
      e.event_type, e.occurred_on::text AS occurred_on, e.description
    FROM family_events e
    JOIN holders h ON h.id = e.holder_id
    LEFT JOIN beneficiaries b ON b.id = e.beneficiary_id
    ORDER BY e.occurred_on DESC, e.id DESC
    LIMIT 20`,
  );
  return {
    families,
    recentOccurrences,
    indicators: {
      activeFamilies: activeFamilies.length,
      monthlyRevenueEstimate,
      deaths,
      utilizations,
      utilizationRatio: activeFamilies.length ? utilizations / activeFamilies.length : 0,
      revenuePerUtilization: utilizations ? monthlyRevenueEstimate / utilizations : null,
    },
  };
});

export const completeRenewal = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        holder_id: z.number(),
        reference_date: z.string().min(1),
        note: z.string().trim().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await auth();
    await assertMutable();
    const q = await sql();
    const [holder] = await q<{ id: number }>("SELECT id FROM holders WHERE id = $1", [
      data.holder_id,
    ]);
    if (!holder) return { ok: false as const, error: "Cadastro familiar não encontrado." };
    await q(
      `INSERT INTO renewal_completions (holder_id, reference_date, completed_by, note)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (holder_id, reference_date)
      DO UPDATE SET completed_by = EXCLUDED.completed_by, note = EXCLUDED.note, completed_at = now()`,
      [data.holder_id, data.reference_date, user.id, data.note || ""],
    );
    await q(
      `INSERT INTO family_events (holder_id, event_type, occurred_on, description, created_by)
      VALUES ($1,'renovacao',current_date,$2,$3)`,
      [
        data.holder_id,
        data.note || `Renovação anual concluída para a referência ${data.reference_date}.`,
        user.id,
      ],
    );
    return { ok: true as const };
  });

// ---------- Contracts ----------
export const uploadContract = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Envio inválido");
    const file = d.get("file");
    const holderId = Number(d.get("holder_id"));
    if (!(file instanceof File) || !holderId) throw new Error("Arquivo inválido");
    return { file, holderId };
  })
  .handler(async ({ data }) => {
    await auth();
    await assertMutable();
    const q = await sql();
    const { saveFile } = await import("./storage.server");
    const bytes = new Uint8Array(await data.file.arrayBuffer());
    const detectedType = detectAllowedFileType(bytes);
    if (!detectedType)
      return { ok: false as const, error: "Envie um PDF ou imagem válida (JPG/PNG/WebP)" };
    if (data.file.size > 20 * 1024 * 1024)
      return { ok: false as const, error: "Arquivo maior que 20 MB" };
    const stored = await saveFile(data.file);
    await q(
      `INSERT INTO contracts (holder_id, file_name, stored_name, mime_type, size_bytes) VALUES ($1,$2,$3,$4,$5)`,
      [data.holderId, data.file.name, stored, detectedType, data.file.size],
    );
    return { ok: true as const };
  });

export const deleteContract = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.number() }).parse(d))
  .handler(async ({ data }) => {
    await auth();
    await assertMutable();
    const q = await sql();
    const { removeFile } = await import("./storage.server");
    const r = await q("DELETE FROM contracts WHERE id = $1 RETURNING stored_name", [data.id]);
    if (r[0]) await removeFile(r[0].stored_name);
    return { ok: true };
  });

// ---------- Invoices ----------
export const listInvoices = createServerFn({ method: "GET" })
  .validator((d: unknown) =>
    z.object({ status: z.string().optional(), month: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await auth();
    const q = await sql();
    return q<{
      id: number;
      holder_id: number;
      holder_name: string;
      reference_month: string;
      amount: number;
      due_date: string;
      status: string;
      paid_at: string | null;
      payment_method: string | null;
    }>(
      `SELECT * FROM (SELECT i.id, h.id AS holder_id, h.name AS holder_name, i.reference_month, i.amount::float AS amount,
        i.due_date::text AS due_date, ${INVOICE_STATUS} AS status, i.paid_at::text AS paid_at, i.payment_method
       FROM invoices i JOIN holders h ON h.id = i.holder_id) t
       WHERE ($1::text IS NULL OR t.status = $1) AND ($2::text IS NULL OR t.reference_month = $2)
       ORDER BY t.due_date DESC, t.holder_name`,
      [data.status && data.status !== "todas" ? data.status : null, data.month || null],
    );
  });

export const generateInvoices = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data }) => {
    await auth();
    await assertMutable();
    const q = await sql();
    const r = await q(
      `INSERT INTO invoices (holder_id, reference_month, amount, due_date)
      SELECT h.id, $1, p.monthly_price, ($1 || '-01')::date + (h.due_day - 1)
      FROM holders h JOIN plans p ON p.id = h.plan_id
      WHERE h.status <> 'cancelado' AND h.join_date <= (($1 || '-01')::date + interval '1 month' - interval '1 day')
      ON CONFLICT (holder_id, reference_month) DO NOTHING RETURNING id`,
      [data.month],
    );
    return { created: r.length };
  });

export const payInvoice = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ id: z.number(), paid_at: z.string(), payment_method: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await auth();
    await assertMutable();
    const q = await sql();
    await q(`UPDATE invoices SET status='paga', paid_at=$1, payment_method=$2 WHERE id=$3`, [
      data.paid_at,
      data.payment_method,
      data.id,
    ]);
    return { ok: true };
  });

export const setInvoiceStatus = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ id: z.number(), status: z.enum(["aberta", "cancelada"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await auth();
    await assertMutable();
    const q = await sql();
    await q(`UPDATE invoices SET status=$1, paid_at=NULL, payment_method=NULL WHERE id=$2`, [
      data.status,
      data.id,
    ]);
    return { ok: true };
  });
