import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Hexagon, ArrowRight, Wallet, Radio, Webhook, LayoutDashboard, Check, Zap, ShieldCheck,
} from "lucide-react";

const MODULES = [
  { icon: Wallet, title: "Checkout Engine", desc: "Public USDC payment pages. Customers connect a Base wallet and settle in one click, sub-cent gas." },
  { icon: Radio, title: "Onchain Listener", desc: "A worker watching Base mainnet for USDC transfers, matching each to the right pending invoice." },
  { icon: Webhook, title: "ERP Sync Engine", desc: "Every paid invoice is formatted and pushed into QuickBooks or Xero as a reconciled entry." },
  { icon: LayoutDashboard, title: "Founder Dashboard", desc: "MRR, active subscriptions, payment history and ERP sync logs in one Web2-clean console." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 glass border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
              <Hexagon className="h-5 w-5" fill="currentColor" />
            </div>
            <span className="font-heading font-extrabold text-lg tracking-tight">LedgerSync</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login"><Button variant="ghost" className="rounded-full" data-testid="nav-login-button">Sign in</Button></Link>
            <Link to="/register"><Button className="rounded-full font-semibold gap-1.5" data-testid="nav-get-started-button">Get started <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 ls-grid-bg opacity-30" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/15 blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20">
          <div className="max-w-3xl ls-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-mono text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-400 ls-pulse" /> Live on Base Mainnet · USDC
            </div>
            <h1 className="mt-6 font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Stablecoin billing that <span className="text-primary">reconciles itself</span>.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl">
              LedgerSync turns onchain USDC payments on Base into compliant Web2 invoices in QuickBooks and Xero — automatically. Accept crypto, keep your books clean.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/register">
                <Button size="lg" className="rounded-full font-semibold gap-2 h-12 px-6" data-testid="hero-get-started-button">
                  Start billing in USDC <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="rounded-full h-12 px-6" data-testid="hero-demo-button">
                  View live demo
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Sub-cent gas fees</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Onchain verified settlement</span>
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Auto ERP reconciliation</span>
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">Four modules. One revenue pipeline.</h2>
        <p className="mt-2 text-muted-foreground max-w-xl">From the moment a customer pays to the journal entry in your books.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m, i) => (
            <div key={m.title} className="ls-card ls-card-hover p-6 ls-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="grid place-items-center h-11 w-11 rounded-xl bg-primary/15 text-primary">
                <m.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-heading font-bold text-lg">{m.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-28">
        <div className="relative overflow-hidden ls-card p-10 sm:p-14 text-center">
          <div className="absolute inset-0 ls-grid-bg opacity-20" />
          <div className="relative">
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">Ship your USDC checkout today</h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">Create your first checkout link in under a minute. No card, no gas headaches.</p>
            <Link to="/register">
              <Button size="lg" className="mt-7 rounded-full font-semibold gap-2 h-12 px-7" data-testid="cta-get-started-button">
                Create free account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Hexagon className="h-4 w-4 text-primary" fill="currentColor" /> LedgerSync
          </div>
          <span className="font-mono text-xs">USDC · Base · chainId 8453</span>
        </div>
      </footer>
    </div>
  );
}
