"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, LoaderCircle, Moon, Save, ShieldCheck, Sun, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PanelHeading } from "@/components/finance-ui";
import { sessionFetch } from "@/lib/session-fetch";
import { useAppearance } from "@/lib/use-appearance";

export default function SettingsPage() {
  const [currentUsername, setCurrentUsername] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { dark, paused, setTheme, setMotion } = useAppearance();

  useEffect(() => {
    sessionFetch("/api/auth/me").then(async (response) => {
      if (!response) return;
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kullanıcı bilgisi alınamadı.");
      setCurrentUsername(data.username); setUsername(data.username);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Kullanıcı bilgisi alınamadı."))
      .finally(() => setLoading(false));
  }, []);

  async function updateUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const response = await sessionFetch("/api/auth/me", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }),
      });
      if (!response) return;
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kullanıcı adı güncellenemedi.");
      setCurrentUsername(data.username); setUsername(data.username); setSuccess("Kullanıcı adın güncellendi.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bağlantı kurulamadı. Lütfen tekrar dene.");
    } finally { setSaving(false); }
  }

  return (
    <AppShell title="Ayarlar" description="Hesap bilgilerini ve uygulama görünümünü yönet.">
      <div className="settings-layout">
        <aside className="panel settings-profile">
          <div className="settings-avatar" aria-hidden="true">{currentUsername ? currentUsername.charAt(0).toLocaleUpperCase("tr-TR") : <UserRound size={28} />}</div>
          <h2>{loading ? "Hesap yükleniyor…" : currentUsername || "Kişisel hesap"}</h2>
          <p>Kişisel finans hesabı</p>
          <span className="panel-badge"><ShieldCheck size={12} />Hesaba özel kayıtlar</span>
          <div className="settings-note"><ShieldCheck size={16} /><span>Kullanıcı adını değiştirdiğinde harcama, ekstre ve yatırım kayıtların aynı hesapta kalır.</span></div>
        </aside>
        <div className="settings-sections">
          <section className="panel">
            <PanelHeading title="Hesap bilgileri" description="Giriş yapmak için kullandığın kullanıcı adını güncelle." />
            <form className="settings-form" onSubmit={updateUsername} aria-busy={saving || loading}>
              <label htmlFor="settings-username" className="form-label">Kullanıcı adı</label>
              <input id="settings-username" type="text" value={username} disabled={loading || saving} onChange={(event) => { setUsername(event.target.value); setError(""); setSuccess(""); }} pattern="[A-Za-z0-9._-]{3,40}" minLength={3} maxLength={40} autoComplete="username" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(error)} aria-describedby={error ? "settings-username-help settings-error" : "settings-username-help"} required />
              <p className="settings-help" id="settings-username-help">3–40 karakter. Harf, rakam, nokta, tire veya alt çizgi kullanılabilir.</p>
              {error ? <p role="alert" id="settings-error" className="notice error" style={{marginTop:16,marginBottom:0}}>{error}</p> : null}
              {success ? <p role="status" className="notice success" style={{marginTop:16,marginBottom:0}}><Check size={15} />{success}</p> : null}
              <div className="settings-actions"><button type="button" className="btn-secondary" disabled={loading || saving || username === currentUsername} onClick={() => { setUsername(currentUsername); setError(""); }}>Vazgeç</button><button className="btn-primary" disabled={loading || saving || username.trim().toLocaleLowerCase("tr-TR") === currentUsername}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}{saving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</button></div>
            </form>
          </section>
          <section className="panel">
            <PanelHeading title="Görünüm" description="Bu tarayıcıda kullanılacak tema ve hareket tercihleri." />
            <div className="panel-body">
              <div className="appearance-options" role="group" aria-label="Tema tercihi">
                {[false,true].map((isDark) => <button className="appearance-option" key={String(isDark)} aria-pressed={dark === isDark} onClick={() => setTheme(isDark)}><span className={"appearance-preview " + (isDark ? "dark" : "")} aria-hidden="true"><i /><div><b /><b /><b /></div></span><span><span className="flex items-center gap-2">{isDark ? <Moon size={14} /> : <Sun size={14} />}{isDark ? "Koyu tema" : "Açık tema"}</span>{dark === isDark ? <Check size={15} /> : null}</span></button>)}
              </div>
              <div className="preference-row"><div><p>Arka plan hareketi</p><small>Arka plan videosunu oynat veya durdur. Cihazın hareketi azalt ayarına uyulur.</small></div><button className="preference-toggle" role="switch" aria-label="Arka plan hareketi" aria-checked={!paused} onClick={() => setMotion(!paused)}><span /></button></div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
