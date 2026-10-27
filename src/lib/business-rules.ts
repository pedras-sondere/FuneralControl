export function canAddBeneficiary(currentCount: number, maximum: number): boolean {
  return maximum > 0 && currentCount < maximum;
}

export function canUsePlanForHolder(plan: { active: boolean } | null | undefined): boolean {
  return plan?.active === true;
}

export function shouldCreateInvoice(alreadyExists: boolean): boolean {
  return !alreadyExists;
}
