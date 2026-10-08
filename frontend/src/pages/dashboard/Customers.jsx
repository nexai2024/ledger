import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, short, formatApiErrorDetail } from "@/lib/api";
import { PageHeader, EmptyState } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Customers() {
  const { data: customers = [], refetch, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await api.get("/customers")).data,
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", walletAddress: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const create = async (e) => {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      await api.post("/customers", form);
      toast.success("Customer added");
      setOpen(false);
      setForm({ name: "", email: "", walletAddress: "" });
      refetch();
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    await api.delete(`/customers/${id}`);
    toast.success("Customer removed");
    refetch();
  };

  return (
    <div className="ls-fade-up">
      <PageHeader title="Customers" subtitle="People and wallets you bill in USDC." testid="customers-heading">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full font-semibold gap-2" data-testid="add-customer-button">
              <Plus className="h-4 w-4" /> Add customer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="font-heading">New customer</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2"><Label>Name</Label>
                <Input data-testid="customer-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ada Okafor" /></div>
              <div className="space-y-2"><Label>Email</Label>
                <Input data-testid="customer-email-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ada@nova.xyz" required /></div>
              <div className="space-y-2"><Label>Wallet address (optional)</Label>
                <Input data-testid="customer-wallet-input" value={form.walletAddress} onChange={(e) => setForm({ ...form, walletAddress: e.target.value })} placeholder="0x…" className="font-mono text-sm" /></div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={saving} className="rounded-full font-semibold" data-testid="customer-save-button">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save customer
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {!isLoading && customers.length === 0 ? (
        <EmptyState icon={Users} title="No customers yet" desc="Add your first customer to create invoices." />
      ) : (
        <div className="ls-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Wallet</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id} data-testid={`customer-row-${c.id}`}>
                    <TableCell className="font-medium">{c.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email}</TableCell>
                    <TableCell className="font-mono text-xs">{c.walletAddress ? short(c.walletAddress, 5) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(c.id)} data-testid={`delete-customer-${c.id}`}
                        className="text-muted-foreground hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
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
