import React, { useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/Page";
import { CopyButton } from "@/components/CopyButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Wallet, Webhook, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    companyName: user?.companyName || "",
    baseWalletAddr: user?.baseWalletAddr || "",
    erpProvider: user?.erpProvider || "NONE",
    erpApiKey: user?.erpApiKey || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (e) => {
    e.preventDefault(); setError(""); setSaving(true);
    try {
      const { data } = await api.put("/settings", {
        ...form,
        erpProvider: form.erpProvider === "NONE" ? "NONE" : form.erpProvider,
      });
      setUser(data);
      toast.success("Settings saved");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="ls-fade-up max-w-2xl">
      <PageHeader title="Settings" subtitle="Settlement wallet, company profile and ERP connection." testid="settings-heading" />

      <form onSubmit={save} className="space-y-6">
        <section className="ls-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="font-heading font-bold">Company</h3>
          </div>
          <div className="space-y-2">
            <Label>Company name</Label>
            <Input data-testid="settings-company-input" value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          </div>
        </section>

        <section className="ls-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Wallet className="h-4 w-4 text-primary" />
            <h3 className="font-heading font-bold">Base settlement wallet</h3>
          </div>
          <div className="space-y-2">
            <Label>Wallet address (USDC settles here)</Label>
            <div className="flex gap-2">
              <Input data-testid="settings-wallet-input" value={form.baseWalletAddr}
                onChange={(e) => setForm({ ...form, baseWalletAddr: e.target.value })}
                placeholder="0x…" className="font-mono text-sm" />
              {form.baseWalletAddr && <CopyButton value={form.baseWalletAddr} className="px-2" />}
            </div>
            <p className="text-xs text-muted-foreground">The onchain listener monitors Base mainnet for USDC transfers to this address.</p>
          </div>
        </section>

        <section className="ls-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Webhook className="h-4 w-4 text-primary" />
            <h3 className="font-heading font-bold">ERP connection</h3>
            <span className="ml-auto text-[11px] font-mono text-amber-400">MOCKED</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={form.erpProvider} onValueChange={(v) => setForm({ ...form, erpProvider: v })}>
                <SelectTrigger data-testid="erp-provider-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  <SelectItem value="QUICKBOOKS">QuickBooks Online</SelectItem>
                  <SelectItem value="XERO">Xero</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>API key</Label>
              <Input data-testid="settings-erp-key-input" value={form.erpApiKey}
                onChange={(e) => setForm({ ...form, erpApiKey: e.target.value })}
                placeholder="qbo_live_…" className="font-mono text-sm" />
            </div>
          </div>
        </section>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" disabled={saving} className="rounded-full font-semibold" data-testid="settings-save-button">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
        </Button>
      </form>
    </div>
  );
}
