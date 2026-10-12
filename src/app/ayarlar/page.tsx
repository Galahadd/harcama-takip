"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, Save, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export default function SettingsPage() {
  const [currentUsername, setCurrentUsername] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Kullanıcı bilgisi alınamadı.");
        setCurrentUsername(data.username);
        setUsername(data.username);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Kullanıcı bilgisi alınamadı."))
      .finally(() => setLoading(false));
  }, []);

  async function updateUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(data.error || "Kullanıcı adı güncellenemedi.");
      return;
    }

    setCurrentUsername(data.username);
    setUsername(data.username);
    setSuccess("Kullanıcı adın güncellendi.");
    window.setTimeout(() => window.location.reload(), 700);
  }

  return (
    <AppShell title="Ayarlar" description="Hesap bilgilerini ve kullanıcı adını yönet.">
      <div className="settings-grid">
        <section className="settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><UserRound size={19} /></span>
            <div><h2>Hesap bilgileri</h2><p>Bu değişiklik yalnızca giriş yaptığın hesabı etkiler.</p></div>
          </div>

          <form onSubmit={updateUsername}>
            <label htmlFor="settings-username" className="form-label">Kullanıcı adı</label>
            <input id="settings-username" type="text" value={username} disabled={loading || saving}
              onChange={(event) => setUsername(event.target.value)} pattern="[A-Za-z0-9._-]{3,40}"
              minLength={3} maxLength={40} autoComplete="username" required />
            <p className="settings-help">Harf, rakam, nokta, tire ve alt çizgi kullanılabilir.</p>
            {error ? <p role="alert" className="settings-feedback error">{error}</p> : null}
            {success ? <p role="status" className="settings-feedback success"><Check size={15} />{success}</p> : null}
            <button className="settings-save" disabled={loading || saving || username.trim().toLocaleLowerCase("tr-TR") === currentUsername}>
              <Save size={16} />{saving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
