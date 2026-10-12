"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Landmark, Plus, ShieldCheck, UserRound } from "lucide-react";

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
    const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: normalized }),
    });
    const data = await response.json();
    setLoading(false);
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
  }

  function changeMode(nextMode: "login" | "create") {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  return (
    <main className="workspace login-screen">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-visual" aria-hidden="true">
          <div className="login-mark"><Landmark size={24} /></div>
          <div>
            <p className="login-eyebrow">KİŞİSEL FİNANS ALANI</p>
            <h2>Her hesap,<br />kendi dünyasında.</h2>
            <p>Harcamalar, ekstreler ve yatırımlar kullanıcılar arasında güvenle ayrılır.</p>
          </div>
          <div className="login-assurance"><ShieldCheck size={18} /><span>Kayıtların yalnızca seçtiğin hesapta görünür.</span></div>
        </div>

        <div className="login-form-panel">
          <div className="login-tabs" role="tablist" aria-label="Hesap işlemi">
            <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "is-active" : ""} onClick={() => changeMode("login")}>Giriş yap</button>
            <button type="button" role="tab" aria-selected={mode === "create"} className={mode === "create" ? "is-active" : ""} onClick={() => changeMode("create")}>Yeni kullanıcı</button>
          </div>
          <div className="login-heading">
            <span className="login-user-icon">{mode === "login" ? <UserRound size={21} /> : <Plus size={21} />}</span>
            <div>
              <h1 id="login-title">{mode === "login" ? "Hesabına giriş yap" : "Yeni hesap oluştur"}</h1>
              <p>{mode === "login" ? "Devam etmek için kullanıcı adını gir." : "Yeni kullanıcı için benzersiz bir ad belirle."}</p>
            </div>
          </div>
          <form onSubmit={submit}>
            <label htmlFor="username">Kullanıcı adı</label>
            <div className="login-input-wrap">
              <UserRound size={17} />
              <input id="username" type="text" autoComplete="username" value={username}
                onChange={(event) => setUsername(event.target.value)} pattern="[A-Za-z0-9._-]{3,40}" minLength={3} maxLength={40} autoFocus required />
            </div>
            <p className="login-hint">Harf, rakam, nokta, tire ve alt çizgi kullanabilirsin.</p>
            {error ? <p role="alert" className="login-feedback error">{error}</p> : null}
            {message ? <p role="status" className="login-feedback success">{message}</p> : null}
            <button disabled={loading} className="login-submit">
              <span>{loading ? "İşleniyor…" : mode === "login" ? "Hesaba geç" : "Kullanıcı oluştur"}</span>
              {mode === "login" ? <ArrowRight size={17} /> : <Plus size={17} />}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
