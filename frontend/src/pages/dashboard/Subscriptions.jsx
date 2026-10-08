import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, usd, formatApiErrorDetail } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Repeat, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Subscriptions() {
  const { data: subs = [], refetch, isLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => (await api.get("/subscriptions")).data,
  });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: async () => (await api.get("/products")).data });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customerId: "", productId: "", status: "ACTIVE" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const create = async (e) => {
    e.preventDefault(); setError(""); setSaving(true);
    try {
      await api.post("/subscriptions", form);
      toast.success("Subscription created");
      setOpen(false);
      setForm({ customerId: "", productId: "", status: "ACTIVE" });
      refetch();
    } catch (err) { setError(formatApiErrorDetail(err.response?.data?.detail) || err.message); }
    finally { setSaving(false); }
  };

  const changeStatus = async (sub, status) => {
    await api.put(`/subscriptions/${sub.id}`, { customerId: sub.customerId, productId: sub.productId, status, nextBillingDate: sub.nextBillingDate });
    toast.success("Subscription updated");
    refetch();
  };

  return (
    <div className="ls-fade-up">
      <PageHeader title="Subscriptions" subtitle="Recurring USDC revenue streams on Base." testid="subscriptions-heading">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full font-semibold gap-2" data-testid="add-subscription-button"><Plus className="h-4 w-4" /> New subscription</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="font-heading">New subscription</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2"><Label>Customer</Label>
                <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                  <SelectTrigger data-testid="sub-customer-select"><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name || c.email}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-2"><Label>Product</Label>
                <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v })}>
                  <SelectTrigger data-testid="sub-product-select"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — ${usd(p.priceUsdc)}</SelectItem>)}</SelectContent>
                </Select></div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={saving || !form.customerId || !form.productId} className="rounded-full font-semibold" data-testid="sub-save-button">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {!isLoading && subs.length === 0 ? (
        <EmptyState icon={Repeat} title="No subscriptions" desc="Attach a customer to a product to start recurring billing." />
      ) : (
        <div className="ls-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Customer</TableHead><TableHead>Product</TableHead>
                  <TableHead className="text-right">Price</TableHead><TableHead>Next billing</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s) => (
                  <TableRow key={s.id} data-testid={`sub-row-${s.id}`}>
                    <TableCell className="font-medium">{s.customer?.name || s.customer?.email || "—"}</TableCell>
                    <TableCell>{s.product?.name || "—"}</TableCell>
                    <TableCell className="text-right font-mono">${usd(s.product?.priceUsdc)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{s.nextBillingDate ? new Date(s.nextBillingDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Select value={s.status} onValueChange={(v) => changeStatus(s, v)}>
                        <SelectTrigger className="w-32 h-8" data-testid={`sub-status-${s.id}`}>
                          <StatusBadge status={s.status} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="PAST_DUE">Past due</SelectItem>
                          <SelectItem value="CANCELED">Canceled</SelectItem>
                        </SelectContent>
                      </Select>
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
