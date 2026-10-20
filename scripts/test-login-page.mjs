import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("../public/login/index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);

class Element {
  constructor(id) {
    this.id = id; this.events = new Map(); this.attributes = new Map(); this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
      toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name),
    };
    this.value = ""; this.hidden = false; this.disabled = false; this.textContent = "";
  }
  addEventListener(name, listener) {
    this.events.set(name, [...(this.events.get(name) || []), listener]);
  }
  async emit(name, event = {}) {
    for (const listener of this.events.get(name) || []) await listener({ preventDefault() {}, target: this, ...event });
  }
  setAttribute(key, value) { this.attributes.set(key, value); }
  removeAttribute(key) { this.attributes.delete(key); }
  toggleAttribute(key, on) { if (on) this.setAttribute(key, ""); else this.removeAttribute(key); }
  focus() { this.focused = true; }
  contains(target) { return target === this; }
  pause() { this.paused = true; }
  play() { this.paused = false; return this.rejectPlayback ? Promise.reject(new Error("Blocked")) : Promise.resolve(); }
}

function environment({ reduced = false, responses = [] } = {}) {
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map((match) => [match[1], new Element(match[1])]));
  const el = (id) => elements.get(id);
  el("formError").hidden = el("formSuccess").hidden = true;
  for (const id of ["bgVideoA", "bgVideoB"]) {
    Object.assign(el(id), { duration: 10.04, currentTime: 0, readyState: 4 });
  }
  el("bgVideoA").classList.add("is-active");
  const document = new Element("document");
  document.getElementById = el;
  document.querySelectorAll = () => [];
  document.hidden = false;
  const media = new Element("media"); media.matches = reduced;
  const requests = [], locations = [], timers = [];
  const context = vm.createContext({
    document,
    matchMedia: () => media,
    window: { location: { assign: (path) => locations.push(path) } },
    AbortSignal,
    setTimeout: (handler) => { const timer = { handler, cleared: false }; timers.push(timer); return timer; },
    clearTimeout: (timer) => { if (timer) timer.cleared = true; },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return { ok: response?.ok ?? true, json: async () => response?.body ?? {} };
    },
  });
  vm.runInContext(scripts[1], context);
  vm.runInContext(scripts[2], context);
  return { el, document, media, requests, locations, timers };
}

test("login is one standalone HTML document with inline styles/scripts", () => {
  assert.equal((html.match(/<style>/g) || []).length, 1);
  assert.equal(scripts.length, 3);
  for (const source of scripts) assert.doesNotThrow(() => new vm.Script(source));
  assert.doesNotMatch(html, /<script[^>]+src=|recep\.kaya11|HAYAT AKAR|Sellix/);
});

test("username login sends the normalized username and returns to the app", async () => {
  const { el, requests, locations } = environment();
  el("username").value = "  TEST.USER  ";
  await el("accountForm").emit("submit");
  assert.equal(requests[0].url, "/api/auth/login");
  assert.deepEqual(JSON.parse(requests[0].body), { username: "test.user" });
  assert.deepEqual(locations, ["/"]);
});

test("creating a user switches to login while keeping the username", async () => {
  const { el, requests, locations } = environment();
  await el("switchMode").emit("click");
  el("username").value = "new.user";
  await el("accountForm").emit("submit");
  assert.equal(requests[0].url, "/api/auth/users");
  assert.equal(el("formTitle").textContent, "Giriş yap");
  assert.equal(el("formSuccess").hidden, false);
  assert.equal(el("username").value, "new.user");
  assert.deepEqual(locations, []);
});

test("API errors and network failure leave a visible error and usable form", async () => {
  for (const response of [{ ok: false, body: { error: "Kullanıcı bulunamadı." } }, new Error("Offline")]) {
    const { el, locations } = environment({ responses: [response] });
    await el("accountForm").emit("submit");
    assert.equal(el("formError").hidden, false);
    assert.ok(el("formError").textContent);
    assert.equal(el("username").disabled, false);
    assert.equal(el("submitButton").disabled, false);
    assert.deepEqual(locations, []);
  }
});

test("ready incoming video crossfades and outgoing video is reset afterward", async () => {
  const { el, timers } = environment();
  el("bgVideoA").currentTime = 9.3;
  await el("bgVideoA").emit("timeupdate");
  assert.equal(el("bgVideoB").classList.contains("is-active"), true);
  assert.equal(el("bgVideoA").classList.contains("is-active"), false);
  timers.find((timer) => !timer.cleared).handler();
  assert.equal(el("bgVideoA").paused, true);
  assert.equal(el("bgVideoA").currentTime, 0);
});

test("unloaded or blocked incoming video does not replace the visible video", async () => {
  for (const blocked of [false, true]) {
    const { el } = environment();
    el("bgVideoA").currentTime = 9.3;
    if (blocked) el("bgVideoB").rejectPlayback = true;
    else el("bgVideoB").readyState = 0;
    await el("bgVideoA").emit("timeupdate");
    assert.equal(el("bgVideoA").classList.contains("is-active"), true);
    assert.equal(el("bgVideoB").classList.contains("is-active"), false);
  }
});

test("reduced motion holds the first frame and skips crossfading", async () => {
  const { el } = environment({ reduced: true });
  assert.equal(el("bgVideoA").paused, true);
  assert.equal(el("bgVideoB").paused, true);
  assert.equal(el("bgVideoA").currentTime, 0);
  el("bgVideoA").currentTime = 9.3;
  await el("bgVideoA").emit("timeupdate");
  assert.equal(el("bgVideoB").classList.contains("is-active"), false);
});

test("pausing during a crossfade cancels cleanup and pauses both copies", async () => {
  const { el, timers } = environment();
  el("bgVideoA").currentTime = 9.3;
  await el("bgVideoA").emit("timeupdate");
  await el("motionButton").emit("click");
  assert.equal(el("bgVideoA").paused, true);
  assert.equal(el("bgVideoB").paused, true);
  assert.equal(el("motionButton").attributes.get("aria-pressed"), "true");
  assert.equal(timers.every((timer) => timer.cleared), true);
});
