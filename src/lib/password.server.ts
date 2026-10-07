import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function scryptAsync(pw: string, salt: string): Promise<Buffer> {
  return new Promise((res, rej) =>
    scrypt(pw, salt, 64, (err, key) => (err ? rej(err) : res(key))),
  );
}

export async function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(pw, salt);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const key = await scryptAsync(pw, salt);
  const exp = Buffer.from(hex, "hex");
  return exp.length === key.length && timingSafeEqual(exp, key);
}
