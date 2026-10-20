"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, ChartNoAxesCombined, Check, FileText, Landmark, LoaderCircle, Plus, UserRound, Wallet } from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "create">("login");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const normalized = username.trim().toLocaleLowerCase("tr-TR");
    try {
      const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalized }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || (mode === "login" ? "Giriş başarısız." : "Kullanıcı eklenemedi."));
        return;
      }
      if (mode === "create") {
        setUsername(normalized);
        setMode("login");
        setMessage(`${normalized} oluşturuldu. Şimdi giriş yapabilirsin.`);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Bağlantı kurulamadı. Lütfen tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode: "login" | "create") {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  return (
    <main className="workspace login-screen">
      <header className="login-brand"><span className="login-brand-symbol"><Landmark size={23} aria-hidden="true" /></span><span>Hesabım<span className="login-brand-caption">Kişisel finans alanın</span></span></header>
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-visual">
          <p className="login-eyebrow"><span /> DAHA NET BİR FİNANSAL BAKIŞ</p>
          <h2>Bugününü anla.<br /><span>Yarınına yer aç.</span></h2>
          <p className="login-intro">Bütçen ne olursa olsun, kendi yolunu çiz. Harcamaların ve birikimlerin tek bir yerde, daha anlaşılır.</p>
          <div className="login-preview" aria-hidden="true">
            <div className="login-preview-top"><span>Finansal görünümün</span><span className="login-preview-badge">Tek bir yerde</span></div>
            <div className="login-preview-title">Küçük adımlar,<br />daha net kararlar.</div>
            <div className="login-chart">{[36, 54, 43, 72, 61, 85, 100].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div>
            <div className="login-preview-bottom"><span>Takip et</span><span>Planla</span><span>Biriktir <ArrowRight size={13} /></span></div>
          </div>
          <ul className="login-features">
            <li><Wallet size={19} aria-hidden="true" /><span><strong>Harcamalarını tanı</strong><small>Günlük giderlerini bir arada gör.</small></span></li>
            <li><FileText size={19} aria-hidden="true" /><span><strong>Ekstrelerini sadeleştir</strong><small>Ödemelerini ve taksitlerini takip et.</small></span></li>
            <li><ChartNoAxesCombined size={19} aria-hidden="true" /><span><strong>Birikimine alan aç</strong><small>Yatırımlarının gelişimini izle.</small></span></li>
          </ul>
        </div>
        <div className="login-form-panel">
          <div className="login-tabs" role="group" aria-label="Hesap işlemi">
            <button disabled={loading} type="button" aria-pressed={mode === "login"} className={mode === "login" ? "is-active" : ""} onClick={() => changeMode("login")}>Giriş yap</button>
            <button disabled={loading} type="button" aria-pressed={mode === "create"} className={mode === "create" ? "is-active" : ""} onClick={() => changeMode("create")}>Hesap oluştur</button>
          </div>
          <div className="login-heading">
            <span className="login-user-icon" aria-hidden="true">{mode === "login" ? <UserRound size={24} /> : <Plus size={24} />}</span>
            <p className="login-form-eyebrow">KENDİ ALANIN, KENDİ DÜZENİN</p>
            <h1 id="login-title">{mode === "login" ? "Tekrar hoş geldin." : "Yeni bir başlangıç."}</h1>
            <p>{mode === "login" ? "Finansal hayatına kaldığın yerden devam et." : "Kendi finans alanını oluşturmakla başla."}</p>
          </div>
          <form onSubmit={submit} aria-busy={loading}>
            <label htmlFor="username">Kullanıcı adı</label>
            <div className="login-input-wrap">
              <UserRound size={19} aria-hidden="true" />
              <input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username}
                onChange={(event) => { setUsername(event.target.value); setError(""); }} pattern="[A-Za-z0-9._-]{3,40}" minLength={3} maxLength={40} required disabled={loading}
                aria-describedby={error ? "username-hint login-error" : "username-hint"} aria-invalid={!!error} />
            </div>
            <p id="username-hint" className="login-hint">3–40 karakter. A–Z harfleri, rakam, nokta, tire veya alt çizgi kullanabilirsin.</p>
            {error ? <p id="login-error" role="alert" className="login-feedback error">{error}</p> : null}
            {message ? <p role="status" className="login-feedback success">{message}</p> : null}
            <button type="submit" disabled={loading} className="login-submit">
              <span>{loading ? "İşleniyor…" : mode === "login" ? "Hesabıma giriş yap" : "Hesabımı oluştur"}</span>
              {loading ? <LoaderCircle size={19} aria-hidden="true" /> : <ArrowRight size={19} aria-hidden="true" />}
            </button>
          </form>
          <div className="login-account-note"><Check size={17} aria-hidden="true" /><p>Her kullanıcı için ayrı bir alan.<br /><span>Harcamaların ve birikimlerin hesabına özel tutulur.</span></p></div>
        </div>
      </section>
      <footer className="login-footer"><span>Hesabım · Kişisel Finans</span><span>Her bütçeye, her yeni başlangıca.</span></footer>
    </main>
  );
}
