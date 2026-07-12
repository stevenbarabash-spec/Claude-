import type { ReactNode } from "react";
import { PanelHelp } from "./PanelHelp";

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
        <PanelHelp title={title} />
        <span className="rule" />
        {right && <span className="right">{right}</span>}
      </header>
      {children}
    </section>
  );
}
