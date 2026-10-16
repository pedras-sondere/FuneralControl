import { randomBytes } from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { q } from "./db.server";
import { hashSessionToken } from "./session-token.server";

const COOKIE = "pf_session";

export type SessionUser = { id: number; name: string; email: string; mustChangePassword: boolean };

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await q("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)", [
    tokenHash,
    userId,
    expires,
  ]);
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    expires,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getCookie(COOKIE);
  if (!token) return null;
  const rows = await q<SessionUser>(
    `SELECT u.id, u.name, u.email, u.must_change_password AS "mustChangePassword" FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [hashSessionToken(token)],
  );
  return rows[0] ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new Error("Não autorizado");
  return u;
}

export async function requireMutableUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.mustChangePassword) {
    throw new Error("Altere a senha inicial antes de continuar.");
  }
  return user;
}

export async function changeOwnPassword({
  currentPassword,
  newPassword,
}: {
  currentPassword: string;
  newPassword: string;
}) {
  const user = await requireUser();
  const rows = await q<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [
    user.id,
  ]);
  const { verifyPassword, hashPassword } = await import("./password.server");
  if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
    return { ok: false as const, error: "A senha atual está incorreta." };
  }
  await q("UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2", [
    await hashPassword(newPassword),
    user.id,
  ]);
  return { ok: true as const };
}

export async function destroySession() {
  const token = getCookie(COOKIE);
  if (token) await q("DELETE FROM sessions WHERE token = $1", [hashSessionToken(token)]);
  deleteCookie(COOKIE, { path: "/" });
}
