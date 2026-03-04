"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Monitor,
    Camera,
    ScrollText,
    Bell,
    LogOut,
    Shield,
    Menu,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";

const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/sessions", label: "Sesiones", icon: Monitor },
    { href: "/screenshots", label: "Pantallas", icon: Camera },
    { href: "/logs", label: "Logs", icon: ScrollText },
    { href: "/alerts", label: "Alertas", icon: Bell },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [unreadAlerts, setUnreadAlerts] = useState(0);

    useEffect(() => {
        async function fetchAlerts() {
            try {
                const res = await fetch("/api/alerts?unread=true");
                if (res.ok) {
                    const data = await res.json();
                    setUnreadAlerts(Array.isArray(data) ? data.length : 0);
                }
            } catch { /* ignore */ }
        }
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 30000);
        return () => clearInterval(interval);
    }, []);

    async function handleLogout() {
        document.cookie = "auth-token=; path=/; max-age=0";
        router.push("/login");
        router.refresh();
    }

    const NavContent = () => (
        <>
            {/* Logo */}
            <div className="p-6 border-b border-border/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="font-bold text-sm">ECA Auditoría</h1>
                        <p className="text-xs text-muted-foreground">Monitoreo RDP</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                            {item.label === "Alertas" && unreadAlerts > 0 && (
                                <Badge variant="destructive" className="ml-auto text-xs h-5 px-1.5">
                                    {unreadAlerts}
                                </Badge>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border/50">
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                    onClick={handleLogout}
                >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                </Button>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile toggle */}
            <Button
                variant="ghost"
                size="icon"
                className="fixed top-4 left-4 z-50 md:hidden"
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed top-0 left-0 h-full w-64 bg-card border-r border-border/50 flex flex-col z-40 transition-transform duration-300",
                    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                )}
            >
                <NavContent />
            </aside>
        </>
    );
}
