import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AuthShell, { GoogleButton } from "@/components/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({ companyName: "", email: "", password: "", name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
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
      title="Start accepting USDC"
      subtitle="Spin up your stablecoin billing stack in seconds."
      footer={
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline" data-testid="goto-login-link">Sign in</Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="company">Company name</Label>
          <Input id="company" data-testid="register-company-input" value={form.companyName}
            onChange={upd("companyName")} placeholder="Nova Labs" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="remail">Work email</Label>
          <Input id="remail" data-testid="register-email-input" type="email" value={form.email}
            onChange={upd("email")} placeholder="founder@startup.xyz" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rpass">Password</Label>
          <Input id="rpass" data-testid="register-password-input" type="password" value={form.password}
            onChange={upd("password")} placeholder="min. 6 characters" required />
        </div>
        {error && <p className="text-sm text-red-400" data-testid="register-error">{error}</p>}
        <Button type="submit" data-testid="founder-register-button" disabled={loading}
          className="w-full rounded-full font-semibold">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create account
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton label="Sign up with Google" />
    </AuthShell>
  );
}
