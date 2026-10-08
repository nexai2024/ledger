import React from "react";
import { Hexagon } from "lucide-react";
import { Link } from "react-router-dom";

export default function AuthShell({ title, subtitle, children, footer }) {
  const redirectToGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 border-r border-border overflow-hidden">
        <div className="absolute inset-0 ls-grid-bg opacity-40" />
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-2.5">
          <div className="grid place-items-center h-9 w-9 rounded-lg bg-primary text-primary-foreground">
            <Hexagon className="h-5 w-5" fill="currentColor" />
          </div>
          <span className="font-heading font-extrabold text-xl tracking-tight">LedgerSync</span>
        </Link>
        <div className="relative space-y-5 max-w-md">
          <h2 className="font-heading text-4xl font-extrabold leading-tight tracking-tight">
            Settle in USDC.<br />Reconcile in QuickBooks.
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            The stablecoin-native billing OS that bridges Base onchain payments into your Web2 accounting stack — automatically.
          </p>
          <div className="flex items-center gap-4 pt-4 font-mono text-xs text-muted-foreground">
            <span className="rounded-full border border-border px-3 py-1">Base Mainnet</span>
            <span className="rounded-full border border-border px-3 py-1">&lt; $0.01 gas</span>
            <span className="rounded-full border border-border px-3 py-1">Auto ERP sync</span>
          </div>
        </div>
        <div className="relative text-xs text-muted-foreground font-mono">USDC · 0x8335…2913 · chainId 8453</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm ls-fade-up">
          <div className="lg:hidden mb-8 flex items-center gap-2.5">
            <div className="grid place-items-center h-9 w-9 rounded-lg bg-primary text-primary-foreground">
              <Hexagon className="h-5 w-5" fill="currentColor" />
            </div>
            <span className="font-heading font-extrabold text-xl tracking-tight">LedgerSync</span>
          </div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer}
        </div>
      </div>
    </div>
  );
}

export function GoogleButton({ label = "Continue with Google" }) {
  const redirectToGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  return (
    <button
      type="button"
      onClick={redirectToGoogle}
      data-testid="google-login-button"
      className="w-full flex items-center justify-center gap-3 rounded-full border border-border bg-secondary/60 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 4.75c1.61 0 3.06.55 4.2 1.64l3.15-3.15C17.45 1.44 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 4.75 12 4.75z"/></svg>
      {label}
    </button>
  );
}
