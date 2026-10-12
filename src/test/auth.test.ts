import { describe, expect, it } from "vitest";

import { hashSessionToken } from "../lib/session-token.server";

describe("tokens de sessão", () => {
  it("produz um digest que não é o token original", () => {
    const token = "token-de-teste";
    expect(hashSessionToken(token)).not.toBe(token);
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });
});
