import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CopyButton({ value, className, testid, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e) => {
    e?.stopPropagation?.();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };
  return (
    <button type="button" onClick={copy} data-testid={testid}
      className={cn("inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors", className)}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {label && <span className="text-xs">{label}</span>}
    </button>
  );
}
