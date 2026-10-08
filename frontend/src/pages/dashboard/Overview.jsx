import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, usd, short } from "@/lib/api";
import { PageHeader } from "@/components/Page";
import CreateInvoiceDialog from "@/components/CreateInvoiceDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import {
  TrendingUp, Repeat, Wallet, Webhook, ArrowUpRight, ExternalLink,
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Link } from "react-router-dom";

function Stat({ icon: Icon, label, value, sub, testid, accent }) {
  return (
    <div className="ls-card ls-card-hover p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <div className={`grid place-items-center h-8 w-8 rounded-lg ${accent || "bg-primary/15 text-primary"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 font-mono text-2xl font-extrabold" data-testid={testid}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function Overview() {
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => (await api.get("/dashboard/stats")).data,
  });
  const { data: invoices = [], refetch: refetchInv } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => (await api.get("/invoices")).data,
  });

  const recent = invoices.slice(0, 6);

  return (
    <div className="ls-fade-up">
      <PageHeader title="Overview" subtitle="Your stablecoin revenue, reconciled in real time." testid="dashboard-heading">
        <CreateInvoiceDialog onCreated={() => { refetchInv(); refetchStats(); }} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={TrendingUp} label="MRR" value={`$${usd(stats?.mrr)}`} sub={`ARR $${usd(stats?.arr)}`} testid="mrr-value-display" />
        <Stat icon={Repeat} label="Active subs" value={stats?.activeSubscriptions ?? "—"} sub={`${stats?.customerCount ?? 0} customers`} testid="active-subs-display" accent="bg-emerald-500/15 text-emerald-400" />
        <Stat icon={Wallet} label="Collected (USDC)" value={`$${usd(stats?.totalCollected)}`} sub={`${stats?.paidCount ?? 0} paid invoices`} testid="collected-display" />
        <Stat icon={Webhook} label="ERP synced" value={`${stats?.syncedCount ?? 0}`} sub={`${stats?.pendingCount ?? 0} pending onchain`} testid="synced-display" accent="bg-amber-500/15 text-amber-400" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 ls-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-heading font-bold text-lg">USDC revenue</h3>
            <span className="text-xs text-muted-foreground font-mono">last 6 months</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.revenueTrend || []} margin={{ left: -18, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0052FF" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#0052FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontFamily: "JetBrains Mono" }}
                  formatter={(v) => [`$${usd(v)} USDC`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#0052FF" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 ls-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-lg">Recent payments</h3>
            <Link to="/dashboard/invoices" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              All <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recent.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 hover:bg-accent transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{inv.customer?.name || inv.customer?.email || "Customer"}</div>
                  <div className="truncate text-xs text-muted-foreground">{inv.description}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold">${usd(inv.amountUsdc)}</div>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
            ))}
            {recent.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No invoices yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
