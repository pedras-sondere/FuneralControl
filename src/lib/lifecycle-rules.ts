export const LIFECYCLE_STATUSES = ["ativo", "falecido", "cancelado"] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export function isLifecycleStatus(value: unknown): value is LifecycleStatus {
  return typeof value === "string" && LIFECYCLE_STATUSES.includes(value as LifecycleStatus);
}

export function canAssumeCurrentHolder(
  originalHolderStatus: LifecycleStatus,
  beneficiaryStatus: LifecycleStatus,
): boolean {
  return originalHolderStatus === "falecido" && beneficiaryStatus === "ativo";
}

export type RenewalReminderKind =
  "sem_data" | "em_dia" | "lembrete_30" | "atrasada";

export type RenewalReminder = {
  kind: RenewalReminderKind;
  referenceDate: string | null;
};

function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Data de renovação inválida.");
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function dateToIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function annualReference(billingDate: string, year: number): string {
  const { month, day } = parseIsoDate(billingDate);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return dateToIso(year, month, Math.min(day, lastDay));
}

function previousMonthDate(value: string): string {
  const { year, month, day } = parseIsoDate(value);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const lastDay = new Date(Date.UTC(previousYear, previousMonth, 0)).getUTCDate();
  return dateToIso(previousYear, previousMonth, Math.min(day, lastDay));
}

export function getRenewalReminder({
  monthlyBillingDate,
  latestCompletedReferenceDate,
  today,
}: {
  monthlyBillingDate: string | null;
  latestCompletedReferenceDate?: string | null;
  today: string;
}): RenewalReminder {
  if (!monthlyBillingDate) return { kind: "sem_data", referenceDate: null };

  const currentYear = parseIsoDate(today).year;
  let referenceDate = annualReference(monthlyBillingDate, currentYear);

  if (latestCompletedReferenceDate && latestCompletedReferenceDate >= referenceDate) {
    referenceDate = annualReference(monthlyBillingDate, currentYear + 1);
  }

  if (today > referenceDate) return { kind: "atrasada", referenceDate };
  if (today >= previousMonthDate(referenceDate)) return { kind: "lembrete_30", referenceDate };
  return { kind: "em_dia", referenceDate };
}
