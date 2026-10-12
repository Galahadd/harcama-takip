"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronRight, Landmark, LogOut, Menu, Moon, Sun, WalletCards, X } from "lucide-react";

const navigation = [
  { href: "/", label: "Harcamalar", icon: WalletCards },
  { href: "/yatirimlar", label: "Yatırımlar", icon: Landmark },
];

export function AppShell({ children, title, description, actions }: {
  children: ReactNode;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [username, setUsername] = useState("");
  const mobileMenu = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    try { setDark(localStorage.getItem("finance-theme") === "dark"); } catch { /* Storage is optional. */ }
    fetch("/api/auth/me").then((response) => response.ok ? response.json() : null).then((data) => {
      if (data?.username) setUsername(data.username);
    }).catch(() => undefined);
  }, []);

  function toggleTheme() {
    setDark(!dark);
    try { localStorage.setItem("finance-theme", dark ? "light" : "dark"); } catch { /* Storage is optional. */ }
  }

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      window.location.href = "/login";
    } catch { setLogoutError(true); }
  }

  const links = (
    <nav aria-label="Ana menü" className="shell-nav">
      <p className="nav-caption">ÇALIŞMA ALANIM</p>
      {navigation.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}
          className={`nav-item ${pathname === href ? "is-active" : ""}`}
          onClick={() => mobileMenu.current?.close()}>
          <Icon size={18} strokeWidth={1.7} /><span>{label}</span>
          {pathname === href ? <ChevronRight size={15} className="ml-auto" /> : null}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="workspace" data-theme={dark ? "dark" : "light"}>
      <a href="#main-content" className="skip-link">İçeriğe geç</a>
      <aside className="desktop-sidebar">
        <Link href="/" className="brand"><span className="brand-icon"><WalletCards size={21} /></span><span>Hesabım<small>Kişisel finans alanın</small></span></Link>
        {links}
        <div className="sidebar-bottom">
          <div className="sidebar-note"><ArrowUpRight size={18} /><p>Her şey bir arada.<small>Harcamalarını izle, birikimini takip et.</small></p></div>
          <div className="profile-row"><span className="avatar">{username ? username.charAt(0).toUpperCase() : "K"}</span><div><strong>{username || "Kişisel hesap"}</strong><small>Finans kontrol paneli</small></div><button className="icon-button" onClick={logout} aria-label="Hesap değiştir" title="Hesap değiştir"><LogOut size={17} /></button></div>
          {logoutError ? <p role="alert" className="text-xs text-red-700">Çıkış yapılamadı. Tekrar deneyin.</p> : null}
        </div>
      </aside>
      <dialog ref={mobileMenu} className="mobile-menu" aria-label="Gezinme menüsü">
        <div className="flex items-center justify-between p-5"><strong>Hesabım</strong><button className="icon-button" onClick={() => mobileMenu.current?.close()} aria-label="Menüyü kapat"><X size={20} /></button></div>
        {links}
        <button className="nav-item m-4" onClick={logout}><LogOut size={18} />Hesap değiştir</button>
        {logoutError ? <p role="alert" className="p-4 text-sm text-red-700">Çıkış yapılamadı. Tekrar deneyin.</p> : null}
      </dialog>
      <div className="shell-body">
        <header className="shell-topbar">
          <button className="icon-button mobile-menu-trigger" onClick={() => mobileMenu.current?.showModal()} aria-label="Menüyü aç"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Çalışma alanı</span><ChevronRight size={14} /><strong>{title}</strong></div>
          <div className="ml-auto flex items-center gap-3"><button className="icon-button" onClick={toggleTheme} aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"} title={dark ? "Açık tema" : "Koyu tema"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button><span className="avatar small" aria-label={username || "Kişisel hesap"}>{username ? username.charAt(0).toUpperCase() : "K"}</span></div>
        </header>
        <main id="main-content" className="shell-content">
          <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div><div className="page-actions">{actions}</div></div>
          {children}
          <footer className="shell-footer">Hesabım <span>Harcamalar & birikimler</span></footer>
        </main>
      </div>
    </div>
  );
}
