import type { ReactNode } from "react";

export function Panel({
  idx,
  title,
  right,
  children,
  className,
}: {
  idx?: string;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className ?? ""}`}>
      <header className="panel-head">
        {idx && <span className="idx">{idx} //</span>}
        <span className="title">{title}</span>
        <span className="rule" />
        {right && <span className="right">{right}</span>}
      </header>
      {children}
    </section>
  );
}
