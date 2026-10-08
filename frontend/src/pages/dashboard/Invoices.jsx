import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, usd, short } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/Page";
import CreateInvoiceDialog from "@/components/CreateInvoiceDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Search, Link2, Download } from "lucide-react";
import { toast } from "sonner";

export default function Invoices() {
  const { data: invoices = [], refetch, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => (await api.get("/invoices")).data,
  });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      if (status !== "ALL" && i.status !== status) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (i.customer?.name || "").toLowerCase().includes(s)
        || (i.customer?.email || "").toLowerCase().includes(s)
        || (i.description || "").toLowerCase().includes(s)
        || (i.onchainTxHash || "").toLowerCase().includes(s)
        || (i.paymentNonce || "").toLowerCase().includes(s);
    });
  }, [invoices, q, status]);

  const copyLink = (inv) => {
    navigator.clipboard.writeText(`${window.location.origin}/pay/${inv.paymentNonce}`);
    toast.success("Checkout link copied");
  };

  const exportCsv = async () => {
    try {
      const res = await api.get("/exports/payments.csv", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ledgersync-payments.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Exported payment history");
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="ls-fade-up">
      <PageHeader title="Invoices" subtitle="Every USDC checkout and its onchain + ERP status." testid="invoices-heading">
        <CreateInvoiceDialog onCreated={() => refetch()} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="invoice-search-input" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search customer, tx hash, nonce…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" data-testid="invoice-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv} className="gap-2 rounded-full" data-testid="export-csv-button">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {!isLoading && filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices" desc="Create a checkout link to start accepting USDC payments." />
      ) : (
        <div className="ls-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Customer</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>ERP</TableHead>
                  <TableHead>Onchain</TableHead>
                  <TableHead className="text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => (
                  <TableRow key={inv.id} data-testid={`invoice-row-${inv.id}`}>
                    <TableCell>
                      <div className="font-medium">{inv.customer?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{inv.customer?.email}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{inv.description}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">${usd(inv.amountUsdc)}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell><StatusBadge status={inv.erpSyncStatus} /></TableCell>
                    <TableCell>
                      {inv.onchainTxHash ? (
                        <a href={`https://basescan.org/tx/${inv.onchainTxHash}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline">
                          {short(inv.onchainTxHash, 5)} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => copyLink(inv)}
                        data-testid={`copy-invoice-link-${inv.id}`}>
                        <Link2 className="h-3.5 w-3.5" /> Copy
                      </Button>
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
