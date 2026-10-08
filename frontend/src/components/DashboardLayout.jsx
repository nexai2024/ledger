import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { short } from "@/lib/api";
import {
  LayoutDashboard, FileText, Users, Package, Repeat, Webhook, Radio, Settings as SettingsIcon,
  LogOut, Hexagon, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true, id: "nav-overview" },
  { to: "/dashboard/invoices", label: "Invoices", icon: FileText, id: "nav-invoices" },
  { to: "/dashboard/customers", label: "Customers", icon: Users, id: "nav-customers" },
  { to: "/dashboard/products", label: "Products", icon: Package, id: "nav-products" },
  { to: "/dashboard/subscriptions", label: "Subscriptions", icon: Repeat, id: "nav-subscriptions" },
  { to: "/dashboard/listener", label: "Onchain Listener", icon: Radio, id: "nav-listener" },
  { to: "/dashboard/erp-sync", label: "ERP Sync", icon: Webhook, id: "nav-erp" },
  { to: "/dashboard/settings", label: "Settings", icon: SettingsIcon, id: "nav-settings" },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const SidebarInner = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-6 h-16 border-b border-border">
        <div className="grid place-items-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
          <Hexagon className="h-5 w-5" fill="currentColor" />
        </div>
        <span className="font-heading font-extrabold text-lg tracking-tight">LedgerSync</span>
      </div>
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            data-testid={n.id}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )
            }
          >
            <n.icon className="h-[18px] w-[18px]" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="grid place-items-center h-9 w-9 rounded-full bg-secondary text-sm font-semibold uppercase">
            {(user?.companyName || user?.name || "L")[0]}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{user?.companyName || "Founder"}</div>
            <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
          </div>
        </div>
        <Button
          data-testid="logout-button"
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-[18px] w-[18px]" /> Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 border-r border-border bg-card/40 z-30">
        {SidebarInner}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-card border-r border-border">{SidebarInner}</div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border px-4 sm:px-8 glass">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} data-testid="mobile-menu-button">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 ls-pulse" />
            Base Mainnet · Live
          </div>
          <div className="ml-auto text-xs font-mono text-muted-foreground hidden sm:block">
            {short(user?.baseWalletAddr) || "No wallet set"}
          </div>
        </header>
        <main className="p-4 sm:p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
