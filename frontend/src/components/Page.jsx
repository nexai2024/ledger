import React from "react";

export function PageHeader({ title, subtitle, children, testid }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight" data-testid={testid}>{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div className="ls-card p-12 text-center">
      {Icon && <Icon className="mx-auto h-9 w-9 text-muted-foreground/60" />}
      <h3 className="mt-3 font-heading font-bold text-lg">{title}</h3>
      {desc && <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
