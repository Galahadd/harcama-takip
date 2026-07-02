export const authCookieName = "expense_session";
const sessionPayload = "personal-expense-tracker";

function getSecret() {
  return process.env.AUTH_SECRET || process.env.APP_PASSWORD || "local-dev-secret";
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

async function hmacSha256(value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toHex(signature);
}

export async function signSession() {
  const signature = await hmacSha256(sessionPayload);
  return `${sessionPayload}.${signature}`;
}

export async function isValidSession(value?: string) {
  if (!value) {
    return false;
  }

  return constantTimeEqual(value, await signSession());
}

export function isValidPassword(password: string) {
  const expected = process.env.APP_PASSWORD || "admin";
  return constantTimeEqual(password, expected);
}
