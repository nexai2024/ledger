import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, short } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Webhook, Code2, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function ErpSync() {
  const { user } = useAuth();
  const { data: logs = [], refetch, isLoading } = useQuery({
    queryKey: ["erp-logs"],
    queryFn: async () => (await api.get("/erp/logs")).data,
  });
  const { data: invoices = [], refetch: refetchInv } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => (await api.get("/invoices")).data,
  });

  const retry = async (invoiceId) => {
    try {
      await api.post(`/invoices/${invoiceId}/retry-sync`);
      toast.success("Re-synced to ERP");
      refetch(); refetchInv();
    } catch (e) {
      toast.error("Retry failed");
    }
  };

  const invMap = Object.fromEntries(invoices.map((i) => [i.id, i]));

  return (
    <div className="ls-fade-up">
      <PageHeader title="ERP Sync Engine" subtitle="Reconciled invoices pushed to your accounting platform." testid="erp-heading" />

      <div className="ls-card p-5 mb-6 flex flex-wrap items-center gap-4">
        <div className="grid place-items-center h-11 w-11 rounded-xl bg-primary/15 text-primary"><Webhook className="h-5 w-5" /></div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Connected provider</div>
          <div className="font-heading font-bold text-lg">
            {user?.erpProvider === "QUICKBOOKS" ? "QuickBooks Online" : user?.erpProvider === "XERO" ? "Xero" : "No provider connected"}
          </div>
        </div>
        <div className="ml-auto">
          {user?.erpProvider
            ? <StatusBadge status="SYNCED" />
            : <StatusBadge status="UNSYNCED" />}
        </div>
      </div>
      <p className="text-xs text-amber-400/80 mb-6 font-mono">⚠ ERP interfaces (QuickBooks / Xero) are MOCKED — payloads are generated and logged, not sent to a live accounting API.</p>

      {!isLoading && logs.length === 0 ? (
        <EmptyState icon={Webhook} title="No sync events yet" desc="Once an invoice is paid onchain, its ERP sync will appear here." />
      ) : (
        <div className="ls-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Invoice</TableHead><TableHead>Provider</TableHead><TableHead>ERP Entry ID</TableHead>
                  <TableHead>Onchain Tx</TableHead><TableHead>Status</TableHead><TableHead>Time</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} data-testid={`erp-log-${log.id}`}>
                    <TableCell className="text-muted-foreground">{invMap[log.invoiceId]?.description || short(log.invoiceId, 4)}</TableCell>
                    <TableCell>{log.provider}</TableCell>
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
