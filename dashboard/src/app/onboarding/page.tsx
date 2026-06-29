"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, Heart } from "lucide-react";

export default function OnboardingPage() {
    const router = useRouter();
    const [alertEmails, setAlertEmails] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [isAppLoading, setIsAppLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setIsAppLoading(false), 800);
        return () => clearTimeout(timer);
    }, []);

    // Simple email validation helper
    function validateEmailsList(emailsStr: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emails = emailsStr.split(",").map(e => e.trim());
        
        if (emails.length === 0 || (emails.length === 1 && emails[0] === "")) {
            return false;
        }

        for (const email of emails) {
            if (!emailRegex.test(email)) {
                return false;
            }
        }
        return true;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        const cleanedEmails = alertEmails.trim();
        if (cleanedEmails.length === 0) {
            setError("Por favor, ingresa al menos un correo.");
            return;
        }

        if (!validateEmailsList(cleanedEmails)) {
            setError("Uno o más correos ingresados no tienen un formato válido (ej. correo@empresa.com).");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/auth/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ alertEmails: cleanedEmails }),
            });

            if (res.ok) {
                // Success: token cookie is refreshed, we can route directly to dashboard root
                router.push("/");
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || "Ocurrió un error al guardar la configuración.");
            }
        } catch {
            setError("Error de conexión con el servidor.");
        } finally {
            setLoading(false);
        }
    }

    if (isAppLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background">
                <div className="flex flex-col items-center justify-center space-y-5 animate-in fade-in duration-500">
                    <Mail className="w-7 h-7 text-foreground/70" />
                    <div className="space-y-2 text-center">
                        <h1 className="text-base font-medium tracking-tight text-foreground/80">ECA Soluciones Empresariales SAC</h1>
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="text-[11px]">Iniciando Configuración...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
            <Card className="w-full max-w-xs border-none shadow-none bg-transparent animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader className="text-center space-y-3 pb-6">
                    <Mail className="w-6 h-6 text-foreground/60 mx-auto" />
                    <div>
                        <CardTitle className="text-lg font-medium tracking-tight">ECA Soluciones Empresariales</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground mt-1">
                            Configuración Inicial de Alertas
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground text-center leading-relaxed">
                        Ingresa los correos donde deseas recibir las alertas críticas del sistema (caídas de servidores, CPU alto y sesiones sospechosas).
                    </p>
                    
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="alertEmails" className="text-xs">Correo(s) de Alerta</Label>
                            <Input
                                id="alertEmails"
                                type="text"
                                placeholder="alertas@empresa.com, admin@empresa.com"
                                value={alertEmails}
                                onChange={(e) => setAlertEmails(e.target.value)}
                                required
                                autoFocus
                                className="h-9 text-sm"
                            />
                            <p className="text-[10px] text-muted-foreground/60 leading-normal">
                                Puedes separar múltiples correos mediante comas (`,`).
                            </p>
                        </div>

                        {error && (
                            <p className="text-xs text-destructive text-center py-1 font-medium">
                                {error}
                            </p>
                        )}

                        <Button type="submit" className="w-full h-9 text-sm" disabled={loading}>
                            {loading ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                                <Mail className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            {loading ? "Guardando..." : "Guardar y Continuar"}
                        </Button>
                    </form>
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
