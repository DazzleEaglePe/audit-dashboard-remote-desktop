"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, CheckCircle, AlertTriangle, KeyRound } from "lucide-react";

function ActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // State management
  const [verifying, setVerifying] = useState(true);
  const [activating, setActivating] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 1. Verify token on mount
  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setError("Falta el token de activación en la URL.");
        setVerifying(false);
        return;
      }

      try {
        const res = await fetch(`/api/auth/activate?token=${token}`);
        if (res.ok) {
          const data = await res.json();
          setUsername(data.username);
        } else {
          const data = await res.json();
          setError(data.error || "El enlace de activación no es válido o ha expirado.");
        }
      } catch (err) {
        setError("Error de conexión al verificar el token.");
      } finally {
        setVerifying(false);
      }
    }
    verifyToken();
  }, [token]);

  // 2. Submit password activation
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setActivating(true);

    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1500);
      } else {
        const data = await res.json();
        setError(data.error || "Ocurrió un error al activar tu cuenta.");
        setActivating(false);
      }
    } catch (err) {
      setError("Error de conexión al activar la cuenta.");
      setActivating(false);
    }
  }

  // Render verifying state
  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-8">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground">Verificando tu token de activación...</p>
      </div>
    );
  }

  // Render error state
  if (error && !username) {
    return (
      <div className="space-y-4 text-center py-6">
        <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Error de Activación</h2>
          <p className="text-xs text-muted-foreground px-4">{error}</p>
        </div>
        <Button onClick={() => router.push("/login")} className="w-full mt-4 h-9 text-xs">
          Ir al Inicio de Sesión
        </Button>
      </div>
    );
  }

  // Render success redirecting state
  if (success) {
    return (
      <div className="space-y-4 text-center py-6">
        <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto animate-bounce" />
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold text-emerald-400">¡Cuenta Activada!</h2>
          <p className="text-xs text-muted-foreground">Redirigiéndote al Dashboard...</p>
        </div>
      </div>
    );
  }

  // Render activation form
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Nombre de Usuario</Label>
        <Input
          type="text"
          value={username}
          disabled
          className="h-9 text-sm bg-accent/10 border-border/40 text-muted-foreground"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-xs">Nueva Contraseña</Label>
        <Input
          id="password"
          type="password"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          className="h-9 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" className="text-xs">Confirmar Contraseña</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Repite la contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="h-9 text-sm"
        />
      </div>

      {error && (
        <p className="text-xs text-destructive text-center py-1 font-medium">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full h-9 text-sm mt-2" disabled={activating}>
        {activating ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <KeyRound className="w-3.5 h-3.5 mr-1.5" />
        )}
        {activating ? "Activando cuenta..." : "Activar Cuenta e Ingresar"}
      </Button>
    </form>
  );
}

export default function ActivatePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-xs border-none shadow-none bg-transparent">
        <CardHeader className="text-center space-y-3 pb-6">
          <Shield className="w-6 h-6 text-foreground/60 mx-auto" />
          <div>
            <CardTitle className="text-lg font-medium tracking-tight">Activación de Cuenta</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Configura tu acceso para iniciar en el panel SaaS
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Cargando...</p>
            </div>
          }>
            <ActivateForm />
          </Suspense>
        </CardContent>
      </Card>
      
      <div className="text-center mt-10 space-y-1 text-muted-foreground/30 text-[10px]">
        <p>&copy; {new Date().getFullYear()} ECA Soluciones Empresariales SAC.</p>
        <p>Todos los derechos reservados.</p>
      </div>
    </div>
  );
}
