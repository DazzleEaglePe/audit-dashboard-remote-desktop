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
    ChevronLeft,
    ChevronRight
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
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [unreadAlerts, setUnreadAlerts] = useState(0);

    useEffect(() => {
        // Hydrate collapse state from local storage or screen size
        const savedState = localStorage.getItem("sidebar-collapsed");
        if (savedState) {
            setIsCollapsed(savedState === "true");
            if (savedState === "true") document.documentElement.classList.add("sidebar-collapsed");
        } else if (window.innerWidth < 1024 && window.innerWidth >= 768) {
            setIsCollapsed(true);
            document.documentElement.classList.add("sidebar-collapsed");
        }

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

    const toggleCollapse = () => {
        const newVal = !isCollapsed;
        setIsCollapsed(newVal);
        localStorage.setItem("sidebar-collapsed", String(newVal));
        if (newVal) {
            document.documentElement.classList.add("sidebar-collapsed");
        } else {
            document.documentElement.classList.remove("sidebar-collapsed");
        }

    };

    async function handleLogout() {
        try {
            const Swal = (await import('sweetalert2')).default;
            const withReactContent = (await import('sweetalert2-react-content')).default;
            const MySwal = withReactContent(Swal);

            const result = await MySwal.fire({
                title: '¿Cerrar sesión?',
                text: "Tendrás que volver a ingresar tus credenciales.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: 'hsl(var(--primary))',
                cancelButtonColor: 'hsl(var(--muted))',
                confirmButtonText: 'Sí, salir',
                cancelButtonText: 'Cancelar',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                customClass: {
                    confirmButton: 'text-primary-foreground',
                    cancelButton: 'text-foreground border border-border bg-transparent',
                }
            });

            if (result.isConfirmed) {
                document.cookie = "auth-token=; path=/; max-age=0";
                router.push("/login");
                router.refresh();
            }
        } catch (error) {
            // Fallback in case chunk fails to load
            if (window.confirm('¿Desea cerrar sesión? Tendrás que volver a ingresar tus credenciales.')) {
                document.cookie = "auth-token=; path=/; max-age=0";
                router.push("/login");
                router.refresh();
            }
        }
    }

    const NavContent = () => (
        <>
            {/* Logo */}
            <div className={cn("p-6 border-b border-border/50 transition-all duration-300", isCollapsed ? "px-4 items-center flex justify-center" : "")}>
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="min-w-10 min-h-10 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div className={cn("transition-all duration-300 truncate", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                        <h1 className="font-bold text-sm truncate">ECA Auditoría</h1>
                        <p className="text-xs text-muted-foreground truncate">Monitoreo RDP</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            title={isCollapsed ? item.label : undefined}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                                isCollapsed ? "justify-center px-0" : ""
                            )}
                        >
                            <item.icon className="w-5 h-5 shrink-0" />
                            <span className={cn("transition-all duration-300 truncate", isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100 block")}>
                                {item.label}
                            </span>
                            {item.label === "Alertas" && unreadAlerts > 0 && (
                                <Badge variant="destructive" className={cn("transition-all", isCollapsed ? "absolute top-1 right-2 w-2 h-2 p-0 rounded-full text-[0px]" : "ml-auto text-xs h-5 px-1.5")}>
                                    {!isCollapsed && unreadAlerts}
                                </Badge>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border/50 flex flex-col gap-2">
                <Button
                    variant="ghost"
                    className={cn("w-full gap-3 text-muted-foreground hover:text-foreground transition-all", isCollapsed ? "justify-center px-0" : "justify-start")}
                    onClick={handleLogout}
                    title={isCollapsed ? "Cerrar sesión" : undefined}
                >
                    <LogOut className="w-5 h-5 shrink-0" />
                    <span className={cn("transition-all duration-300 truncate", isCollapsed ? "w-0 opacity-0 hidden" : "block")}>Cerrar sesión</span>
                </Button>

                {/* Desktop Collapse Toggle */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="hidden md:flex w-full justify-center text-muted-foreground hover:bg-accent h-8 mt-2"
                    onClick={toggleCollapse}
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </Button>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile toggle */}
            <Button
                variant="outline"
                size="icon"
                className="fixed top-3 left-4 z-50 md:hidden bg-background/80 backdrop-blur-sm border-border/50"
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar Desktop & Mobile */}
            <aside
                className={cn(
                    "fixed top-0 left-0 h-full bg-card/95 backdrop-blur-xl border-r border-border/50 flex flex-col z-50 transition-all duration-300 ease-in-out",
                    // Mobile classes
                    mobileOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full",
                    // Desktop classes
                    "md:translate-x-0",
                    isCollapsed ? "md:w-20" : "md:w-64"
                )}
            >
                <NavContent />
            </aside>
        </>
    );
}
