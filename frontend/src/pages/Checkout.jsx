import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, formatApiErrorDetail, short, usd } from "@/lib/api";
import { hasWallet, connectWallet, payUsdc } from "@/lib/web3";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import {
  Hexagon, Wallet, Loader2, CheckCircle2, ExternalLink, ShieldCheck, Zap, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const STEPS = {
  idle: "Connect wallet to pay",
  connecting: "Connecting wallet…",
  broadcasting: "Confirm in your wallet…",
  confirming: "Verifying on Base…",
  paid: "Payment reconciled",
};

export default function Checkout() {
  const { nonce } = useParams();
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [account, setAccount] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await api.get(`/checkout/${nonce}`);
      setData(res.data);
      if (res.data.invoice.status === "PAID") {
        setPhase("paid");
        setTxHash(res.data.invoice.onchainTxHash);
      }
    } catch (err) {
      setLoadErr(formatApiErrorDetail(err.response?.data?.detail) || "Checkout link not found");
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [nonce]);

  const connect = async () => {
    setError("");
    setPhase("connecting");
    try {
      const acc = await connectWallet();
      setAccount(acc);
      setPhase("idle");
      toast.success(`Wallet connected: ${short(acc)}`);
    } catch (err) {
      setError(err.message);
      setPhase("idle");
    }
  };

  const pay = async () => {
    setError("");
    if (!data?.merchant?.settlementWallet) {
      setError("Merchant has not configured a settlement wallet yet.");
      return;
    }
    try {
      setPhase("broadcasting");
      const hash = await payUsdc({
        usdcContract: data.chain.usdcContract,
        to: data.merchant.settlementWallet,
        amountUsdc: data.invoice.amountUsdc,
        decimals: data.chain.decimals,
        from: account,
      });
      setTxHash(hash);
      toast.message("Transaction broadcast", { description: short(hash, 8) });
      setPhase("confirming");
      // Poll confirm until chain has the receipt
      let ok = false;
      for (let i = 0; i < 20 && !ok; i++) {
        try {
          const res = await api.post(`/checkout/${nonce}/confirm`, { txHash: hash });
          if (res.data.status === "PAID") { ok = true; break; }
        } catch (e) {
          const msg = formatApiErrorDetail(e.response?.data?.detail) || "";
          if (!/not found on Base yet/i.test(msg)) throw e;
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
      if (!ok) throw new Error("Could not confirm payment on Base in time. It may still settle shortly.");
      setPhase("paid");
      toast.success("Payment reconciled & synced to ERP");
      load();
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
      setPhase(account ? "idle" : "idle");
    }
  };

  if (loadErr) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <div className="ls-card p-8 text-center max-w-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
          <h1 className="mt-3 font-heading text-xl font-bold">Link unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{loadErr}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const { invoice, merchant, customer, chain } = data;
  const paid = phase === "paid";
  const busy = ["connecting", "broadcasting", "confirming"].includes(phase);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 ls-grid-bg opacity-20" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[700px] rounded-full bg-primary/10 blur-3xl" />

      <div className="relative max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2.5 mb-10">
          <div className="grid place-items-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
            <Hexagon className="h-5 w-5" fill="currentColor" />
          </div>
          <span className="font-heading font-extrabold text-lg tracking-tight">LedgerSync</span>
          <span className="ml-auto text-xs font-mono text-muted-foreground">Secure USDC Checkout · Base</span>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* Summary (asymmetric) */}
          <div className="lg:col-span-3 ls-card p-8 ls-fade-up">
            <div className="text-sm text-muted-foreground">Payment to</div>
            <div className="font-heading text-2xl font-extrabold tracking-tight">{merchant.companyName}</div>
            <div className="mt-8 space-y-4">
              <Row label="Item">{invoice.description}</Row>
              {customer?.email && <Row label="Billed to">{customer.name || customer.email}</Row>}
              <Row label="Network">
                <span className="font-mono text-sm">Base · chainId {chain.chainId}</span>
              </Row>
              <Row label="Est. gas fee"><span className="font-mono text-emerald-400 text-sm">&lt; $0.01</span></Row>
              <Row label="Payment nonce">
                <span className="inline-flex items-center gap-2 font-mono text-xs" data-testid="invoice-nonce-display">
                  {invoice.paymentNonce}
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                </span>
              </Row>
              <div className="border-t border-border pt-5 flex items-end justify-between">
                <span className="text-muted-foreground">Total due</span>
                <span className="font-mono text-3xl font-extrabold" data-testid="checkout-total-amount">
                  {usd(invoice.amountUsdc)} <span className="text-base text-muted-foreground">USDC</span>
                </span>
              </div>
            </div>
            <div className="mt-6 rounded-lg bg-secondary/40 p-3 text-xs font-mono text-muted-foreground break-all">
              Settles to {merchant.settlementWallet || "wallet not configured"}
            </div>
          </div>

          {/* Action card */}
          <div className="lg:col-span-2 ls-card p-8 ls-fade-up" style={{ animationDelay: "100ms" }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Status</span>
              <StatusBadge status={paid ? "PAID" : invoice.status} testid="tx-status-badge" />
            </div>

            {paid ? (
              <div className="mt-8 text-center">
                <div className="mx-auto grid place-items-center h-16 w-16 rounded-full bg-emerald-500/15">
                  <CheckCircle2 className="h-9 w-9 text-emerald-400" />
                </div>
                <h3 className="mt-4 font-heading text-xl font-bold">Payment reconciled</h3>
                <p className="mt-1 text-sm text-muted-foreground">Settled onchain & synced to the merchant's books.</p>
                {txHash && (
                  <a href={`${chain.explorer}/tx/${txHash}`} target="_blank" rel="noreferrer"
                    data-testid="basescan-link"
                    className="mt-5 inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-mono">
                    View on BaseScan <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-lg border border-border p-3 flex items-center gap-3">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  {account ? (
                    <span className="font-mono text-sm" data-testid="connected-wallet">{short(account, 6)}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">No wallet connected</span>
                  )}
                  {account && <span className="ml-auto text-xs text-emerald-400 font-mono">Connected</span>}
                </div>

                {!account ? (
                  <Button onClick={connect} disabled={busy} data-testid="checkout-connect-wallet-button"
                    className="w-full h-12 rounded-full font-semibold gap-2">
                    {phase === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                    Connect Base wallet
                  </Button>
                ) : (
                  <Button onClick={pay} disabled={busy} data-testid="checkout-pay-usdc-button"
                    className="w-full h-12 rounded-full font-semibold gap-2">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    {busy ? STEPS[phase] : `Pay ${usd(invoice.amountUsdc)} USDC`}
                  </Button>
                )}

                {!hasWallet() && (
                  <p className="text-xs text-amber-400 text-center">
                    No Web3 wallet detected. Install MetaMask or Coinbase Wallet to pay.
                  </p>
                )}
                {txHash && (
                  <a href={`${chain.explorer}/tx/${txHash}`} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 text-xs text-primary hover:underline font-mono">
                    Track tx on BaseScan <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {error && <p className="text-sm text-red-400 text-center" data-testid="checkout-error">{error}</p>}
                <p className="text-center text-xs text-muted-foreground">Powered by LedgerSync · Base Mainnet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{children}</span>
    </div>
  );
}
