"use client";

import { useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Globe, ChevronRight, Home, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
    const [lang, setLang] = useState("ES");
    const pathname = usePathname();
    const { t } = useLanguage();

    // Map paths to translations
    const getBreadcrumbs = () => {
        const segments = pathname.split("/").filter(Boolean);
        const list = [{ label: t("sidebar.dashboard") || "Inicio", href: "/" }];

        segments.forEach((seg) => {
            if (seg === "sessions") {
                list.push({ label: t("sidebar.sessions") || "Sesiones", href: "/sessions" });
            } else if (seg === "screenshots") {
                list.push({ label: t("sidebar.screenshots") || "Capturas", href: "/screenshots" });
            } else if (seg === "logs") {
                list.push({ label: t("sidebar.logs") || "Bitácora", href: "/logs" });
            } else if (seg === "alerts") {
                list.push({ label: t("sidebar.alerts") || "Alertas", href: "/alerts" });
            } else if (seg === "settings") {
                list.push({ label: t("sidebar.settings") || "Configuración", href: "/settings" });
            }
        });

        return list;
    };

    const breadcrumbs = getBreadcrumbs();

    return (
        <header className="h-16 border border-border/20 glass-ios sticky top-4 mx-4 mt-4 md:mx-8 md:mt-6 z-30 flex items-center justify-between px-6 gap-3 rounded-2xl">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Home className="w-3.5 h-3.5" />
                {breadcrumbs.map((bc, idx) => (
                    <div key={bc.href} className="flex items-center gap-1.5">
                        <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                        <span className={idx === breadcrumbs.length - 1 ? "text-foreground font-semibold" : "hover:text-foreground transition-colors"}>
                            {bc.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {/* Language Toggle */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-9 gap-1.5 font-semibold rounded-xl hover:bg-accent/40 text-xs text-foreground/80">
                            <Globe className="w-4 h-4 text-muted-foreground/80" />
                            <span className="hidden sm:inline-block">{lang === "ES" ? "Español" : "English"}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground/60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-border/20 backdrop-blur-md">
                        <DropdownMenuItem className="rounded-lg text-xs" onClick={() => setLang("ES")}>Español (ES)</DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg text-xs" onClick={() => setLang("EN")}>English (EN)</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Dark Mode Toggle */}
                <div className="rounded-xl hover:bg-accent/40 h-9 w-9 flex items-center justify-center transition-colors">
                    <ModeToggle />
                </div>
            </div>
        </header>
    );
}
