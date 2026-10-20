import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadSource(file, globals = {}, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    URL,
    require: (name) => dependencies[name] ?? require(name),
    ...globals,
  });
  return exports;
}

function client(response) {
  const redirects = [];
  const { sessionFetch } = loadSource("../src/lib/session-fetch.ts", {
    fetch: async () => response,
    window: { location: { replace: (url) => redirects.push(url) } },
  });
  return { sessionFetch, redirects };
}

test("expired sessions redirect without exposing a response to page error handlers", async () => {
  const { sessionFetch, redirects } = client(new Response('{"error":"Oturum bulunamadı."}', { status: 401 }));
  assert.equal(await sessionFetch("/api/summary"), null);
  assert.deepEqual(redirects, ["/login"]);
});

test("followed login redirects do not get parsed as API JSON", async () => {
  const { sessionFetch, redirects } = client({ redirected: true, url: "https://example.test/login", status: 200 });
  assert.equal(await sessionFetch("/api/gold"), null);
  assert.deepEqual(redirects, ["/login"]);
});

test("valid responses and ordinary server failures do not sign users out", async () => {
  for (const status of [200, 400, 409, 500, 503]) {
    const response = new Response("{}", { status });
    const { sessionFetch, redirects } = client(response);
    assert.equal(await sessionFetch("/api/gold"), response);
    assert.deepEqual(redirects, []);
  }
});

const { middleware } = loadSource("../middleware.ts", {}, {
  "./src/lib/auth": { authCookieName: "expense_session", getSessionUsername: async () => null },
});
const request = (pathname) => ({
  nextUrl: { pathname },
  url: `https://example.test${pathname}`,
  cookies: { get: () => undefined },
});

test("unauthenticated API requests get 401 JSON; page requests redirect to login", async () => {
  const api = await middleware(request("/api/summary"));
  assert.equal(api.status, 401);
  assert.equal((await api.json()).error, "Oturum bulunamadı.");
  const page = await middleware(request("/yatirimlar"));
  assert.equal(page.status, 307);
  assert.equal(page.headers.get("location"), "https://example.test/login");
});

test("login and auth endpoints remain accessible without a redirect loop", async () => {
  for (const path of ["/login", "/api/auth/login", "/api/auth/users"]) {
    const response = await middleware(request(path));
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.status, 200);
  }
});
