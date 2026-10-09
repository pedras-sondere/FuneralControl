export function normalizeCpf(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) {
    throw new Error("CPF deve conter 11 dígitos.");
  }
  return digits;
}

export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^([0-9])\1{10}$/.test(digits)) return false;

  let first = 0;
  for (let index = 0; index < 9; index += 1) first += Number(digits[index]) * (10 - index);
  const firstCheck = (first * 10) % 11 % 10;
  if (firstCheck !== Number(digits[9])) return false;

  let second = 0;
  for (let index = 0; index < 10; index += 1) second += Number(digits[index]) * (11 - index);
  const secondCheck = (second * 10) % 11 % 10;
  return secondCheck === Number(digits[10]);
}
