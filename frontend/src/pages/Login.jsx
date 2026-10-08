import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AuthShell, { GoogleButton } from "@/components/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data);
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your LedgerSync command center."
      footer={
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline" data-testid="goto-register-link">
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" data-testid="login-email-input" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="founder@startup.xyz" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary" data-testid="forgot-password-link">
              Forgot password?
            </Link>
          </div>
          <Input id="password" data-testid="login-password-input" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        {error && <p className="text-sm text-red-400" data-testid="login-error">{error}</p>}
        <Button type="submit" data-testid="founder-login-button" disabled={loading}
          className="w-full rounded-full font-semibold">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton />
    </AuthShell>
  );
}
