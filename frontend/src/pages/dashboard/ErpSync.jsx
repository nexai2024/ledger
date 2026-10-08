import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api, short } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Webhook, Code2, ExternalLink, RefreshCw, Plug, Unplug, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";

const PROVIDERS = [
  { key: "qbo", name: "QuickBooks Online", color: "text-[#2CA01C]" },
  { key: "xero", name: "Xero", color: "text-[#13B5EA]" },
];

function ConnectionCard({ p, status, onConnect, onDisconnect }) {
  const s = status?.[p.key] || {};
  return (
    <div className="ls-card p-5 flex flex-col" data-testid={`erp-connection-${p.key}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className={`h-5 w-5 ${p.color}`} />
          <span className="font-heading font-bold">{p.name}</span>
        </div>
        {s.connected
          ? <StatusBadge status="SYNCED" />
          : s.configured
            ? <StatusBadge status="UNSYNCED" />
            : <span className="font-mono text-[11px] font-semibold tracking-wide px-2.5 py-0.5 rounded-full text-muted-foreground bg-muted border border-border">NOT CONFIGURED</span>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground flex-1">
        {s.connected
          ? `Connected ${p.key === "qbo" ? "· realm " + short(s.realmId, 4) : "· live reconciliation on"}`
          : s.configured
            ? "Credentials configured. Connect to push paid invoices live."
            : "Server credentials not set yet — add Client ID/Secret to enable."}
      </p>
      <div className="mt-4">
        {s.connected ? (
          <Button variant="outline" size="sm" className="gap-2 rounded-full w-full" onClick={() => onDisconnect(p.key)}
            data-testid={`disconnect-${p.key}-button`}>
            <Unplug className="h-4 w-4" /> Disconnect
          </Button>
        ) : s.configured ? (
          <Button size="sm" className="gap-2 rounded-full w-full font-semibold" onClick={() => onConnect(p.key)}
            data-testid={`connect-${p.key}-button`}>
            <Plug className="h-4 w-4" /> Connect {p.name}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" disabled className="gap-2 rounded-full w-full"
            data-testid={`connect-${p.key}-disabled`}>
            <Lock className="h-4 w-4" /> Awaiting credentials
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ErpSync() {
  const [params, setParams] = useSearchParams();
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["accounting-status"],
    queryFn: async () => (await api.get("/accounting/status")).data,
  });
  const { data: logs = [], refetch, isLoading } = useQuery({
    queryKey: ["erp-logs"],
    queryFn: async () => (await api.get("/erp/logs")).data,
  });
  const { data: invoices = [], refetch: refetchInv } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => (await api.get("/invoices")).data,
  });

  useEffect(() => {
    if (params.get("connected")) {
      toast.success(`${params.get("connected") === "qbo" ? "QuickBooks" : "Xero"} connected — live sync is on`);
      refetchStatus();
      setParams({}, { replace: true });
    } else if (params.get("error")) {
      toast.error(`Could not connect ${params.get("error") === "qbo" ? "QuickBooks" : "Xero"}. Please retry.`);
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line
  }, [params]);

  const connect = async (provider) => {
    try {
      const { data } = await api.get(`/accounting/${provider}/connect`);
      window.location.href = data.authUrl;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Connection not available");
    }
  };

  const disconnect = async (provider) => {
    await api.post(`/accounting/${provider}/disconnect`);
    toast.success("Disconnected");
    refetchStatus();
  };

  const retry = async (invoiceId) => {
    try {
      await api.post(`/invoices/${invoiceId}/retry-sync`);
      toast.success("Re-synced to ERP");
      refetch(); refetchInv();
    } catch {
      toast.error("Retry failed");
    }
  };

  const anyLive = status && (status.qbo?.connected || status.xero?.connected);
  const invMap = Object.fromEntries(invoices.map((i) => [i.id, i]));

  return (
    <div className="ls-fade-up">
      <PageHeader title="ERP Sync Engine" subtitle="Reconciled invoices pushed to your accounting platform." testid="erp-heading" />

      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        {PROVIDERS.map((p) => (
          <ConnectionCard key={p.key} p={p} status={status} onConnect={connect} onDisconnect={disconnect} />
        ))}
      </div>
      <p className="text-xs mb-6 font-mono" data-testid="erp-mode-note">
        {anyLive
          ? <span className="text-emerald-400">● LIVE mode — paid invoices create real sandbox entries in your connected ledger.</span>
          : <span className="text-amber-400/80">● MOCK mode — payloads are generated & logged (no live account connected). Connect above to go live.</span>}
      </p>

      {!isLoading && logs.length === 0 ? (
        <EmptyState icon={Webhook} title="No sync events yet" desc="Once an invoice is paid onchain, its ERP sync will appear here." />
      ) : (
        <div className="ls-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Invoice</TableHead><TableHead>Provider</TableHead><TableHead>Mode</TableHead><TableHead>ERP Entry ID</TableHead>
                  <TableHead>Onchain Tx</TableHead><TableHead>Status</TableHead><TableHead>Time</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} data-testid={`erp-log-${log.id}`}>
                    <TableCell className="text-muted-foreground">{invMap[log.invoiceId]?.description || short(log.invoiceId, 4)}</TableCell>
                    <TableCell>{log.provider}</TableCell>
                    <TableCell>
                      <span className={`font-mono text-[10px] uppercase ${log.mode === "live" ? "text-emerald-400" : "text-amber-400"}`}>
                        {log.mode || "mock"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.erpInvoiceId || "—"}</TableCell>
                    <TableCell>
                      {log.onchainTxHash ? (
                        <a href={`https://basescan.org/tx/${log.onchainTxHash}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline">
                          {short(log.onchainTxHash, 5)} <ExternalLink className="h-3 w-3" />
                        </a>) : "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={log.status} testid="erp-sync-status-badge" /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(log.ts).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" data-testid={`inspect-payload-${log.id}`}>
                              <Code2 className="h-3.5 w-3.5" /> Payload
                            </Button>
                          </SheetTrigger>
                          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                            <SheetHeader><SheetTitle className="font-heading">Web2 ERP payload</SheetTitle></SheetHeader>
                            <pre className="mt-6 rounded-xl bg-background border border-border p-4 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-words">
{JSON.stringify(log.payload, null, 2)}
                            </pre>
                            <div className="mt-4 text-xs text-muted-foreground">{log.message}</div>
                          </SheetContent>
                        </Sheet>
                        {log.status === "ERROR" && (
                          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-amber-400" onClick={() => retry(log.invoiceId)}
                            data-testid={`retry-sync-${log.id}`}>
                            <RefreshCw className="h-3.5 w-3.5" /> Retry
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
