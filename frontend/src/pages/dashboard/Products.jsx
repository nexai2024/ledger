import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, usd, formatApiErrorDetail } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/Page";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Package, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const INTERVALS = { MONTHLY: "/mo", YEARLY: "/yr", ONE_TIME: " once" };

export default function Products() {
  const { data: products = [], refetch, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", priceUsdc: "", billingInterval: "MONTHLY" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const create = async (e) => {
    e.preventDefault(); setError(""); setSaving(true);
    try {
      await api.post("/products", { ...form, priceUsdc: parseFloat(form.priceUsdc) });
      toast.success("Product created");
      setOpen(false);
      setForm({ name: "", priceUsdc: "", billingInterval: "MONTHLY" });
      refetch();
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally { setSaving(false); }
  };

  const remove = async (id) => { await api.delete(`/products/${id}`); toast.success("Product removed"); refetch(); };

  return (
    <div className="ls-fade-up">
      <PageHeader title="Products" subtitle="Plans and one-time items priced in USDC." testid="products-heading">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full font-semibold gap-2" data-testid="add-product-button"><Plus className="h-4 w-4" /> Add product</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="font-heading">New product</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2"><Label>Name</Label>
                <Input data-testid="product-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pro Plan" required /></div>
              <div className="space-y-2"><Label>Price (USDC)</Label>
                <Input data-testid="product-price-input" type="number" step="0.01" min="0" value={form.priceUsdc} onChange={(e) => setForm({ ...form, priceUsdc: e.target.value })} placeholder="99.00" required /></div>
              <div className="space-y-2"><Label>Billing interval</Label>
                <Select value={form.billingInterval} onValueChange={(v) => setForm({ ...form, billingInterval: v })}>
                  <SelectTrigger data-testid="product-interval-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                    <SelectItem value="ONE_TIME">One time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={saving} className="rounded-full font-semibold" data-testid="product-save-button">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save product
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {!isLoading && products.length === 0 ? (
        <EmptyState icon={Package} title="No products" desc="Create plans to attach to subscriptions." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="ls-card ls-card-hover p-5" data-testid={`product-card-${p.id}`}>
              <div className="flex items-start justify-between">
                <div className="grid place-items-center h-10 w-10 rounded-xl bg-primary/15 text-primary"><Package className="h-5 w-5" /></div>
                <Button variant="ghost" size="icon" onClick={() => remove(p.id)} data-testid={`delete-product-${p.id}`}
                  className="text-muted-foreground hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
              </div>
              <h3 className="mt-4 font-heading font-bold text-lg">{p.name}</h3>
              <div className="mt-1 font-mono text-2xl font-extrabold">
                ${usd(p.priceUsdc)}<span className="text-sm text-muted-foreground font-normal">{INTERVALS[p.billingInterval]}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
