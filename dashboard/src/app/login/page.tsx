"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Monitor, Shield, Loader2, Heart } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [isAppLoading, setIsAppLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setIsAppLoading(false), 1500);
        return () => clearTimeout(timer);
    }, []);

    async function handleForgotPassword() {
        const Swal = (await import('sweetalert2')).default;
        const withReactContent = (await import('sweetalert2-react-content')).default;
        const MySwal = withReactContent(Swal);

        MySwal.fire({
            html: `
                <div style="padding: 8px 0;">
                    <p style="font-size: 15px; font-weight: 500; margin-bottom: 6px;">¿Necesitas ayuda?</p>
                    <p style="font-size: 13px; opacity: 0.55; line-height: 1.6; margin-bottom: 24px;">Contacta al administrador para restablecer tu acceso.</p>
                    <div style="display: flex; gap: 8px;">
                        <a href="https://wa.me/51954153338" target="_blank" style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 10px 16px; border: 1px solid var(--border); border-radius: 8px; font-size: 12px; font-weight: 500; color: var(--foreground); text-decoration: none; transition: background 0.15s;">WhatsApp</a>
                        <a href="mailto:brunoty000@gmail.com" style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 10px 16px; border: 1px solid var(--border); border-radius: 8px; font-size: 12px; font-weight: 500; color: var(--foreground); text-decoration: none; transition: background 0.15s;">Correo</a>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true,
            background: 'var(--card)',
            color: 'var(--foreground)',
            width: 320,
            customClass: {
                popup: 'border border-border rounded-2xl shadow-lg',
                closeButton: 'text-muted-foreground hover:text-foreground focus:outline-none hover:bg-transparent',
            },
            buttonsStyling: false,
        });
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        if (username.trim().length === 0) {
            setError("Por favor, ingresa tu usuario.");
            return;
        }
        if (password.trim().length === 0) {
            setError("Por favor, ingresa tu contraseña.");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                router.push("/");
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || "Credenciales inválidas");
            }
        } catch {
            setError("Error de conexión");
        } finally {
            setLoading(false);
        }
    }

    if (isAppLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background">
                <div className="flex flex-col items-center justify-center space-y-5 animate-in fade-in duration-500">
                    <Shield className="w-7 h-7 text-foreground/70" />
                    <div className="space-y-2 text-center">
                        <h1 className="text-base font-medium tracking-tight text-foreground/80">ECA Soluciones Empresariales SAC</h1>
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="text-[11px]">Cargando...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
            <Card className="w-full max-w-xs border-none shadow-none bg-transparent">
                <CardHeader className="text-center space-y-3 pb-6">
                    <Shield className="w-6 h-6 text-foreground/60 mx-auto" />
                    <div>
                        <CardTitle className="text-lg font-medium tracking-tight">ECA Soluciones Empresariales</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground mt-1">
                            Panel de Auditoría
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="username" className="text-xs">Usuario</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="admin"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoFocus
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-xs">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="h-9 text-sm"
                            />
                        </div>

                        {error && (
                            <p className="text-xs text-destructive text-center py-1">
                                {error}
                            </p>
                        )}

                        <Button type="submit" className="w-full h-9 text-sm" disabled={loading}>
                            {loading ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                                <Monitor className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            {loading ? "Verificando..." : "Ingresar"}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                        >
                            ¿Problemas de acceso?
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Footer */}
            <div className="text-center mt-10 space-y-2">
                <p className="text-[11px] text-muted-foreground/50">
                    Hecho con <Heart className="w-2.5 h-2.5 inline text-muted-foreground/40" /> por{" "}
                    <a
                        href="https://www.brunovelasques.dev/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold hover:text-foreground transition-colors"
                    >
                        Bruno Velasques
                    </a>
                </p>
                <p className="text-[10px] text-muted-foreground/30">
                    &copy; {new Date().getFullYear()} ECA Soluciones Empresariales SAC. Todos los derechos reservados.
                </p>
            </div>
        </div>
    );
}
