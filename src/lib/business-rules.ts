export function canAddBeneficiary(currentCount: number, maximum: number): boolean {
  return maximum > 0 && currentCount < maximum;
}

export function shouldCreateInvoice(alreadyExists: boolean): boolean {
  return !alreadyExists;
}
