import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MAP = {
  PAID: { label: "PAID", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  SYNCED: { label: "SYNCED", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  ACTIVE: { label: "ACTIVE", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  PENDING: { label: "PENDING", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  UNSYNCED: { label: "UNSYNCED", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  PAST_DUE: { label: "PAST DUE", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  FAILED: { label: "FAILED", cls: "text-red-400 bg-red-500/10 border-red-500/30" },
  ERROR: { label: "SYNC ERROR", cls: "text-red-400 bg-red-500/10 border-red-500/30" },
  CANCELED: { label: "CANCELED", cls: "text-muted-foreground bg-muted border-border" },
};

export function StatusBadge({ status, testid }) {
  const m = MAP[status] || { label: status, cls: "text-muted-foreground bg-muted border-border" };
  return (
    <Badge
      data-testid={testid}
      variant="outline"
      className={cn("font-mono text-[11px] font-semibold tracking-wide px-2.5 py-0.5 rounded-full", m.cls)}
    >
      {m.label}
    </Badge>
  );
}
