"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sessionFetch } from "@/lib/session-fetch";
import { useAppearance } from "@/lib/use-appearance";
import { WorkspaceBackground } from "@/components/workspace-background";
import { ChevronRight, CircleHelp, Landmark, LogOut, Moon, Pause, Play, Settings, ShieldCheck, Sun, WalletCards } from "lucide-react";

const navigation = [
  { href: "/", label: "Harcamalar", icon: WalletCards, detail: "Harcama & ekstre" },
  { href: "/yatirimlar", label: "Yatırımlar", icon: Landmark, detail: "Altın portföyü" },
  { href: "/ayarlar", label: "Ayarlar", icon: Settings, detail: "Hesap & görünüm" },
];

export function AppShell({ children, title, description, actions }: {
  children: ReactNode; title: string; description: string; actions?: ReactNode;
}) {
  const pathname = usePathname();
  const { dark, paused, setTheme, setMotion } = useAppearance();
  const [logoutError, setLogoutError] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    sessionFetch("/api/auth/me").then((response) => response?.ok ? response.json() : null).then((data) => {
      if (data?.username) setUsername(data.username);
    }).catch(() => undefined);
  }, []);

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      window.location.href = "/login";
    } catch { setLogoutError(true); }
  }

  const initial = username ? username.charAt(0).toLocaleUpperCase("tr-TR") : "H";
  return (
    <div className="workspace" data-theme={dark ? "dark" : "light"} data-motion={paused ? "paused" : "running"}>
      <WorkspaceBackground paused={paused} />
      <a href="#main-content" className="skip-link">İçeriğe geç</a>
      <aside className="desktop-sidebar">
        <Link href="/" className="brand"><span className="brand-icon"><WalletCards size={22} aria-hidden="true" /></span><span>Hesabım<small>Kişisel finans</small></span></Link>
        <div className="sidebar-workspace"><span className="workspace-dot" /><div>Kişisel çalışma alanı<small>Harcama & yatırım takibi</small></div><ChevronRight size={14} aria-hidden="true" /></div>
        <nav aria-label="Ana menü" className="shell-nav">
          <p className="nav-caption">FİNANS</p>
          {navigation.slice(0, 2).map(({ href, label, icon: Icon, detail }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`nav-item ${pathname === href ? "is-active" : ""}`}><Icon size={19} aria-hidden="true" /><span>{label}<small>{detail}</small></span>{pathname === href ? <span className="nav-active-dot" /> : null}</Link>)}
          <p className="nav-caption nav-caption-secondary">HESAP</p>
          <Link href="/ayarlar" aria-current={pathname === "/ayarlar" ? "page" : undefined} className={`nav-item ${pathname === "/ayarlar" ? "is-active" : ""}`}><Settings size={19} aria-hidden="true" /><span>Ayarlar<small>Hesap & görünüm</small></span>{pathname === "/ayarlar" ? <span className="nav-active-dot" /> : null}</Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><ShieldCheck size={18} aria-hidden="true" /><p>Hesaba özel kayıtlar<small>Ekstre ve yatırımların yalnızca bu hesapta görüntülenir.</small></p></div>
          <div className="profile-row"><Link href="/ayarlar" className="profile-link"><span className="avatar">{initial}</span><span><strong>{username || "Hesabım"}</strong><small>Kişisel hesap</small></span></Link><button className="icon-button" onClick={logout} aria-label="Hesap değiştir" title="Hesap değiştir"><LogOut size={17} /></button></div>
          {logoutError ? <p role="alert" className="sidebar-error">Çıkış yapılamadı. Tekrar dene.</p> : null}
        </div>
      </aside>
      <div className="shell-body">
        <header className="shell-topbar">
          <Link href="/" className="mobile-brand" aria-label="Hesabım ana sayfa"><WalletCards size={22} /></Link>
          <div className="breadcrumb"><span>Kişisel finans</span><ChevronRight size={13} aria-hidden="true" /><strong>{title}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button motion-toggle" onClick={() => setMotion(!paused)} aria-label={paused ? "Arka plan hareketini başlat" : "Arka plan hareketini durdur"} aria-pressed={paused} title={paused ? "Hareketi başlat" : "Hareketi durdur"}>{paused ? <Play size={17} /> : <Pause size={17} />}</button>
            <button className="icon-button" onClick={() => setTheme(!dark)} aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"} title={dark ? "Açık tema" : "Koyu tema"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <span className="topbar-divider" />
            <Link href="/ayarlar" className="topbar-profile" aria-label={username ? `${username} hesap ayarları` : "Hesap ayarları"}><span className="avatar small">{initial}</span><span>{username || "Hesabım"}</span></Link>
            <button className="icon-button mobile-logout" onClick={logout} aria-label="Hesap değiştir"><LogOut size={17} /></button>
          </div>
        </header>
        <main id="main-content" className="shell-content">
          <div className="page-heading"><div className="heading-copy"><p className="page-eyebrow">FİNANS KONTROL PANELİ</p><h1>{title}</h1><p>{description}</p></div><div className="page-actions">{actions}</div></div>
          {logoutError ? <p className="notice error" role="alert">Çıkış yapılamadı. Lütfen tekrar dene.</p> : null}
          {children}
          <footer className="shell-footer"><span>Hesabım <span className="footer-dot">·</span> Kişisel finans</span><span><CircleHelp size={13} aria-hidden="true" /> Tutarlar Türk lirası cinsindendir.</span></footer>
        </main>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Mobil ana menü">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={pathname === href ? "is-active" : ""}><Icon size={20} aria-hidden="true" /><span>{label}</span></Link>)}</nav>
    </div>
  );
}
