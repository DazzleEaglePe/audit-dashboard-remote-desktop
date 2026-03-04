"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Monitor, Shield, Loader2 } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
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

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Background gradient orbs */}
            <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-chart-2/10 rounded-full blur-3xl" />

            <Card className="w-full max-w-md mx-4 glass border-border/50">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Shield className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold">ECA Auditoría</CardTitle>
                        <CardDescription className="text-muted-foreground mt-1">
                            Sistema de Monitoreo de Escritorios Remotos
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Usuario</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="admin"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3 text-center">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Monitor className="w-4 h-4 mr-2" />
                            )}
                            {loading ? "Ingresando..." : "Ingresar al Dashboard"}
                        </Button>
                    </form>

                    <p className="text-xs text-muted-foreground text-center mt-6">
                        ECA Estudio Contable Alvarez — Panel de Auditoría
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
