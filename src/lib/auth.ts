export const authCookieName = "expense_session";
const sessionPrefix = "expense-tracker";

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

export function normalizeUsername(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

export function isValidUsername(value: string) {
  return /^[a-z0-9._-]{3,40}$/.test(value);
}

export async function signSession(username: string) {
  const payload = `${sessionPrefix}:${normalizeUsername(username)}`;
  return `${payload}.${await hmacSha256(payload)}`;
}

export async function getSessionUsername(value?: string) {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator < 0) return null;
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!payload.startsWith(`${sessionPrefix}:`) || !constantTimeEqual(signature, await hmacSha256(payload))) return null;
  const username = payload.slice(sessionPrefix.length + 1);
  return isValidUsername(username) ? username : null;
}

export async function isValidSession(value?: string) {
  return Boolean(await getSessionUsername(value));
}

export async function getRequestUsername(request: Request) {
  const cookie = request.headers.get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${authCookieName}=`))
    ?.slice(authCookieName.length + 1);
  return getSessionUsername(cookie ? decodeURIComponent(cookie) : undefined);
}
