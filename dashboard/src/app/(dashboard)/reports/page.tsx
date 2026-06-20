"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { BarChart3, LineChart, PieChart, ArrowLeft, Wrench, Sparkles } from "lucide-react";
import { gsap } from "gsap";

export default function ReportsPage() {
    const { t } = useLanguage();
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
            tl.fromTo(containerRef.current,
                { opacity: 0, y: -10 },
                { opacity: 1, y: 0, duration: 0.6 }
            )
            .fromTo(containerRef.current.querySelectorAll(".animate-item"),
                { opacity: 0, y: 15 },
                { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 },
                "-=0.35"
            );
        }
    }, []);

    return (
        <div ref={containerRef} className="space-y-6 max-w-5xl mx-auto opacity-0">
            {/* Header */}
            <div className="animate-item flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">{t("reportsPage.title") || "Reportes y Estadísticas"}</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {t("reportsPage.subtitle") || "Módulo de analítica avanzada"}
                    </p>
                </div>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-2 self-start sm:self-center rounded-xl border border-border/10 hover:bg-accent/40 text-xs font-semibold"
                    onClick={() => router.push("/")}
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t("reportsPage.backDashboard") || "Volver al Dashboard"}
                </Button>
            </div>

            {/* Main Construction Card */}
            <Card className="animate-item glass border-border/20 rounded-2xl overflow-hidden shadow-xl shadow-primary/2 relative p-8 md:p-12 flex flex-col items-center justify-center text-center">
                {/* Glowing background highlights */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-violet-500/10 rounded-full blur-[80px] pointer-events-none" />

                {/* Animated Icon and Badge */}
                <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.15)] text-primary">
                        <Wrench className="w-10 h-10 animate-pulse" />
                    </div>
                    <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        Beta
                    </div>
                </div>

                <h2 className="text-xl md:text-2xl font-black text-foreground max-w-md">
                    {t("reportsPage.constructionTitle") || "Módulo en Construcción"}
                </h2>
                
                <p className="text-xs md:text-sm text-muted-foreground/80 max-w-xl mt-3 leading-relaxed font-medium">
                    {t("reportsPage.constructionDesc") || "Estamos diseñando un panel de reportes interactivo con analíticas detalladas de las conexiones, tiempos de inactividad, y estadísticas de auditoría en tiempo real."}
                </p>

                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/20 text-primary rounded-full text-[10px] font-bold uppercase tracking-wider mt-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                    {t("reportsPage.comingSoon") || "Próximamente disponible"}
                </div>

                {/* Blurry Premium Mock Graphs Grid */}
                <div className="w-full mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 opacity-30 select-none pointer-events-none filter blur-[2px] transition-all duration-500 hover:blur-[1px]">
                    {/* Mock Graph 1 */}
                    <div className="bg-background/25 border border-border/15 p-5 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between text-xs font-bold">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><BarChart3 className="w-3.5 h-3.5" /> Conexiones RDP</span>
                            <span className="text-[10px] text-muted-foreground/60 font-semibold">Últimos 7 días</span>
                        </div>
                        <div className="h-24 flex items-end gap-2 pt-2 px-1">
                            {[40, 60, 45, 80, 55, 70, 90].map((h, i) => (
                                <div key={i} className="flex-1 bg-gradient-to-t from-primary/45 to-primary rounded-t" style={{ height: `${h}%` }} />
                            ))}
                        </div>
                    </div>

                    {/* Mock Graph 2 */}
                    <div className="bg-background/25 border border-border/15 p-5 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between text-xs font-bold">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><LineChart className="w-3.5 h-3.5" /> Tiempo Inactivo</span>
                            <span className="text-[10px] text-muted-foreground/60 font-semibold">Promedio Diario</span>
                        </div>
                        <div className="h-24 flex items-end relative pt-2">
                            <svg className="w-full h-full text-violet-500" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <path d="M0,80 Q25,30 50,60 T100,20" fill="none" stroke="currentColor" strokeWidth="3" />
                                <path d="M0,80 Q25,30 50,60 T100,20 L100,100 L0,100 Z" fill="currentColor" fillOpacity="0.1" />
                            </svg>
                        </div>
                    </div>

                    {/* Mock Graph 3 */}
                    <div className="bg-background/25 border border-border/15 p-5 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between text-xs font-bold">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><PieChart className="w-3.5 h-3.5" /> Uso de Servidores</span>
                            <span className="text-[10px] text-muted-foreground/60 font-semibold">Porcentaje</span>
                        </div>
                        <div className="h-24 flex items-center justify-center pt-2">
                            <div className="w-16 h-16 rounded-full border-8 border-t-emerald-500 border-r-emerald-500/40 border-b-emerald-500/10 border-l-emerald-500/70 animate-spin" style={{ animationDuration: '6s' }} />
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
