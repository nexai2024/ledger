import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import AuthShell from "@/components/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Password reset. Please sign in.");
      navigate("/login");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password you haven't used before."
      footer={
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary font-medium hover:underline" data-testid="back-to-signin-link">Back to sign in</Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="npass">New password</Label>
          <Input id="npass" data-testid="reset-password-input" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="min. 6 characters" required />
        </div>
        {error && <p className="text-sm text-red-400" data-testid="reset-error">{error}</p>}
        <Button type="submit" data-testid="reset-submit-button" disabled={loading || !token} className="w-full rounded-full font-semibold">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Reset password
        </Button>
      </form>
    </AuthShell>
  );
}
