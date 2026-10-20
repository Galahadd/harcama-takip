"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Inbox, X, type LucideIcon } from "lucide-react";

export function StatCard({ label, value, detail, icon: Icon, featured = false, tone = "default", loading = false }: {
  label: string; value: ReactNode; detail: ReactNode; icon: LucideIcon; featured?: boolean;
  tone?: "default" | "positive" | "negative"; loading?: boolean;
}) {
  return <section className={`stat-card ${featured ? "is-featured" : ""} tone-${tone}`} aria-busy={loading}>
    <div className="stat-label"><span>{label}</span><span className="stat-icon"><Icon size={18} aria-hidden="true" /></span></div>
    <div className={`stat-value ${loading ? "is-loading" : ""}`}>{loading ? "—" : value}</div>
    <div className="stat-detail">{detail}</div>
  </section>;
}

export function PanelHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="panel-heading"><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{action}</div>;
}

export function EmptyState({ title, description, action, icon: Icon = Inbox }: {
  title: string; description: string; action?: ReactNode; icon?: LucideIcon;
}) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={24} aria-hidden="true" /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function TablePagination({ page, pages, total, pageSize, onChange }: {
  page: number; pages: number; total: number; pageSize: number; onChange: (page: number) => void;
}) {
  return <div className="table-pagination"><p>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}` : "0"} <span>/ {total} kayıt</span></p>
    <div><button className="icon-button" aria-label="Önceki sayfa" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={17} /></button><span>{page} / {pages}</span><button className="icon-button" aria-label="Sonraki sayfa" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={17} /></button></div>
  </div>;
}

export function FormDialog({ open, onClose, title, description, children }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return <dialog ref={ref} className="form-dialog" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
    onCancel={onClose} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-content"><div className="dialog-heading"><div><h2 id={titleId}>{title}</h2>{description ? <p id={descriptionId}>{description}</p> : null}</div><button className="icon-button" aria-label="Pencereyi kapat" onClick={onClose} type="button"><X size={20} /></button></div>{children}</div>
  </dialog>;
}
