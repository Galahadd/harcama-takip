"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Giris basarisiz.");
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="workspace login-screen">
      <form onSubmit={login} className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-700 text-white">
            <LockKeyhole size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Hesabım</h1>
            <p className="text-sm text-slate-500">Kişisel finans alanına hoş geldin.</p>
          </div>
        </div>
        <label className="text-sm font-medium" htmlFor="password">
          Uygulama şifresi
        </label>
        <input
          id="password"
          className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          required
        />
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <button disabled={loading} className="mt-5 h-11 w-full rounded-md bg-teal-700 text-sm font-medium text-white hover:bg-teal-800">
          {loading ? "Kontrol ediliyor…" : "Giriş yap"}
        </button>
        <p className="mt-6 text-center text-xs text-slate-500">Harcamalarını ve birikimlerini tek yerden yönet.</p>
      </form>
    </main>
  );
}
