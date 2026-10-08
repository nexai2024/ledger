import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import AuthShell from "@/components/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, MailCheck } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a secure link to set a new password."
      footer={
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary font-medium hover:underline" data-testid="back-to-signin-link">Back to sign in</Link>
        </p>
      }
    >
      {sent ? (
        <div className="rounded-xl border border-border bg-secondary/40 p-6 text-center" data-testid="forgot-confirmation">
          <MailCheck className="mx-auto h-8 w-8 text-emerald-400" />
          <p className="mt-3 text-sm text-muted-foreground">
            If that email is registered, a reset link has been sent. Check your inbox.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="femail">Email</Label>
            <Input id="femail" data-testid="forgot-email-input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="founder@startup.xyz" required />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" data-testid="forgot-submit-button" disabled={loading} className="w-full rounded-full font-semibold">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
