import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, usd, short } from "@/lib/api";
import { PageHeader } from "@/components/Page";
import { CopyButton } from "@/components/CopyButton";
import { Radio, Activity, Box, ExternalLink, CheckCircle2, Clock, Zap } from "lucide-react";

function timeAgo(ts) {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function Listener() {
  const { data } = useQuery({
    queryKey: ["listener-status"],
    queryFn: async () => (await api.get("/listener/status")).data,
    refetchInterval: 5000,
  });

  const events = data?.events || [];
  const [newHashes, setNewHashes] = useState(new Set());
  const [flash, setFlash] = useState(false);
  const seenRef = useRef(null);

  // Detect newly-arrived events for a satisfying highlight pulse
  useEffect(() => {
    const current = new Set(events.map((e) => e.txHash));
    if (seenRef.current === null) {
      seenRef.current = current; // first load: don't flash seeded data
      return;
    }
    const fresh = [...current].filter((h) => !seenRef.current.has(h));
    seenRef.current = current;
    if (fresh.length > 0) {
      setNewHashes(new Set(fresh));
      setFlash(true);
      const t1 = setTimeout(() => setFlash(false), 1200);
      const t2 = setTimeout(() => setNewHashes(new Set()), 4000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [events]);

  const totalSeen = events.reduce((sum, e) => sum + Number(e.amountUsdc || 0), 0);

  return (
    <div className="ls-fade-up">
      <PageHeader title="Onchain Listener" subtitle="Live USDC transfer monitoring on Base mainnet." testid="listener-heading">
        <div className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-mono font-semibold transition-colors ${flash ? "border-emerald-400 bg-emerald-500/20 text-emerald-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}
          data-testid="listener-live-indicator">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ls-pulse" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          LIVE
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div className="ls-card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Box className="h-4 w-4" /> Block height</div>
          <div className="mt-3 font-mono text-2xl font-extrabold tabular-nums" data-testid="block-height-display">
            {data?.latestBlock ? data.latestBlock.toLocaleString() : "—"}
          </div>
        </div>
        <div className="ls-card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Activity className="h-4 w-4" /> Poll status</div>
          <div className="mt-3 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 ls-pulse" />
            <span className="font-mono text-sm font-semibold text-emerald-400">{data?.running ? "LISTENING" : "IDLE"}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Last poll {timeAgo(data?.lastPollTs)}</div>
        </div>
        <div className="ls-card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Zap className="h-4 w-4" /> Seen (feed)</div>
          <div className="mt-3 font-mono text-2xl font-extrabold tabular-nums" data-testid="listener-total-seen">${usd(totalSeen)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{events.length} transfer{events.length === 1 ? "" : "s"}</div>
        </div>
        <div className="ls-card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Radio className="h-4 w-4" /> USDC contract</div>
          <div className="mt-3 flex items-center gap-2 font-mono text-sm">
            {short(data?.usdcContract, 5)}
            {data?.usdcContract && <CopyButton value={data.usdcContract} />}
          </div>
        </div>
      </div>

      <div className="ls-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-heading font-bold text-lg">Live event feed</h3>
          <span className="text-xs text-muted-foreground font-mono">Transfer → settlement wallet · refreshing every 5s</span>
        </div>
        {events.length === 0 ? (
          <div className="py-12 text-center">
            <Radio className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">No USDC transfers detected yet. The worker scans Base every ~25s.</p>
            <p className="mt-1 text-xs text-muted-foreground">Set your settlement wallet in Settings so incoming payments can be matched.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((e, i) => {
              const isNew = newHashes.has(e.txHash);
              return (
                <div key={e.txHash + i}
                  className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-all duration-500 ${isNew ? "border-emerald-400/60 bg-emerald-500/10 ls-glow" : "border-border"}`}
                  style={isNew ? { animation: "ls-fade-up 0.5s ease both" } : undefined}
                  data-testid={`listener-event-${i}`}>
                  <div className={`grid place-items-center h-9 w-9 rounded-lg ${e.matched ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"} ${isNew ? "ls-pulse" : ""}`}>
                    {e.matched ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm font-semibold flex items-center gap-2">
                      +{usd(e.amountUsdc)} USDC
                      {isNew && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">NEW</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Block {e.block?.toLocaleString()} · {timeAgo(e.ts)} · {e.matched ? "matched invoice" : "unmatched"}
                    </div>
                  </div>
                  <a href={`https://basescan.org/tx/${e.txHash}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline">
                    {short(e.txHash, 5)} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
