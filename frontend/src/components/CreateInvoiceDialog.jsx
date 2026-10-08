import React, { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Link2 } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { toast } from "sonner";

export default function CreateInvoiceDialog({ onCreated, trigger }) {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customerId: "", amountUsdc: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      api.get("/customers").then(({ data }) => setCustomers(data)).catch(() => {});
      setCreated(null);
      setError("");
      setForm({ customerId: "", amountUsdc: "", description: "" });
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/invoices", {
        customerId: form.customerId,
        amountUsdc: parseFloat(form.amountUsdc),
        description: form.description,
      });
      setCreated(data);
      onCreated?.(data);
      toast.success("Checkout link created");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const link = created ? `${window.location.origin}/pay/${created.paymentNonce}` : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="create-checkout-link-button" className="rounded-full font-semibold gap-2">
            <Plus className="h-4 w-4" /> New checkout link
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Create USDC checkout link</DialogTitle>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <Link2 className="h-4 w-4" /> Shareable payment link
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-background/60 p-2.5">
                <code className="truncate font-mono text-xs" data-testid="created-checkout-link">{link}</code>
                <CopyButton value={link} testid="copy-checkout-link" />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-mono font-semibold">{created.amountUsdc} USDC</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Nonce</span>
              <span className="font-mono text-xs">{created.paymentNonce}</span>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setCreated(null)} className="rounded-full">Create another</Button>
              <Button onClick={() => setOpen(false)} className="rounded-full">Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                <SelectTrigger data-testid="invoice-customer-select">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name || c.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customers.length === 0 && (
                <p className="text-xs text-amber-400">Add a customer first (Customers tab).</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USDC)</Label>
              <Input id="amount" data-testid="invoice-amount-input" type="number" step="0.01" min="0.01"
                value={form.amountUsdc} onChange={(e) => setForm({ ...form, amountUsdc: e.target.value })}
                placeholder="99.00" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Input id="desc" data-testid="invoice-description-input" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Pro Plan — June" />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <DialogFooter>
              <Button type="submit" data-testid="invoice-create-submit" disabled={loading || !form.customerId}
                className="rounded-full font-semibold">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Generate link
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
