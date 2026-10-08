import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    const sessionId = match ? decodeURIComponent(match[1]) : null;

    const run = async () => {
      if (!sessionId) {
        navigate("/login");
        return;
      }
      try {
        const { data } = await api.post("/auth/google/session", {}, { headers: { "X-Session-ID": sessionId } });
        window.history.replaceState(null, "", window.location.pathname);
        setUser(data);
        navigate("/dashboard");
      } catch {
        navigate("/login");
      }
    };
    run();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Securing your session…</p>
    </div>
  );
}
