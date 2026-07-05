"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { getSocket } from "@/lib/socket-client";
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
    ChevronRight,
    Users,
    Server,
    LineChart,
    Settings,
    ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useLanguage } from "@/components/language-provider";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useLanguage();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [unreadAlerts, setUnreadAlerts] = useState(0);
    const [logoutOpen, setLogoutOpen] = useState(false);
    const navItems = [
        { href: "/", label: t("sidebar.dashboard"), icon: LayoutDashboard },
        { href: "/screenshots", label: t("sidebar.screenshots"), icon: Monitor },
        { href: "/sessions", label: t("sidebar.sessions"), icon: Users },
        { href: "/#servers", label: t("sidebar.servers"), icon: Server },
        { href: "/alerts", label: t("sidebar.alerts"), icon: Bell },
        { href: "/reports", label: t("sidebar.reports"), icon: LineChart },
        { href: "/users", label: t("sidebar.users") || "Usuarios", icon: Users },
        { href: "/settings", label: t("sidebar.settings"), icon: Settings },
    ];
    const [profile, setProfile] = useState<{ fullName: string; avatarUrl: string; username: string; role: string }>({
        fullName: "Administrador",
        avatarUrl: "",
        username: "admin",
        role: "viewer"
    });

    async function fetchProfile() {
        try {
            const res = await fetch("/api/auth/profile");
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
            }
        } catch { /* ignore */ }
    }

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
        const interval = setInterval(fetchAlerts, 60000); // Fallback polling every 60s

        // Realtime alerts updates using WebSocket singleton
        const socketIo = getSocket();
        if (socketIo) {
            socketIo.on("alert:new", fetchAlerts);
        }

        fetchProfile();
        window.addEventListener("profile-updated", fetchProfile);

        return () => {
            clearInterval(interval);
            window.removeEventListener("profile-updated", fetchProfile);
            if (socketIo) {
                socketIo.off("alert:new", fetchAlerts);
            }
        };
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

    function confirmLogout() {
        document.cookie = "auth-token=; path=/; max-age=0";
        router.push("/login");
        router.refresh();
    }

    const NavContent = () => (
        <>
            {/* Logo */}
            <div className={cn("p-6 border-b border-border/20 transition-all duration-300", isCollapsed ? "px-4 items-center flex justify-center" : "")}>
                <div className="flex items-center gap-3 overflow-hidden group/logo">
                    <div className="min-w-10 min-h-10 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 shadow-lg shadow-primary/5 group-hover/logo:scale-105 transition-transform duration-300">
                        <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div className={cn("transition-all duration-300 truncate", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                        <h1 className="font-bold text-sm tracking-tight truncate">{t("sidebar.title")}</h1>
                        <p className="text-[10px] text-muted-foreground tracking-wide uppercase truncate font-semibold mt-0.5">{t("sidebar.subtitle")}</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
                {navItems
                    .filter((item) => {
                        if (profile.role === "viewer") {
                            return item.href !== "/users" && item.href !== "/settings";
                        }
                        return true;
                    })
                    .map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            title={isCollapsed ? item.label : undefined}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 group relative border border-transparent",
                                isActive
                                    ? "bg-primary/10 text-primary border-primary shadow-[0_0_12px_rgba(99,102,241,0.18)]"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                                isCollapsed ? "justify-center px-0" : ""
                            )}
                        >
                            {/* Glowing Active Border Dot for Collapsed mode */}
                            {isActive && isCollapsed && (
                                <div className="absolute left-1 w-1 h-6 bg-primary rounded-full shadow-[0_0_10px_var(--primary)]" />
                            )}
                            <item.icon className={cn("w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-105", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                            <span className={cn("transition-all duration-300 truncate", isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100 block")}>
                                {item.label}
                            </span>
                            {item.href === "/alerts" && unreadAlerts > 0 && (
                                <Badge variant="destructive" className={cn("transition-all border-none bg-red-500 text-white font-semibold", isCollapsed ? "absolute top-1 right-2 w-2 h-2 p-0 rounded-full text-[0px]" : "ml-auto text-[10px] h-4.5 px-1.5 rounded-full")}>
                                    {!isCollapsed && unreadAlerts}
                                </Badge>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            {/* User Profile and Logout Footer */}
            <div className="p-4 border-t border-border/20 flex flex-col gap-3">
                <div className={cn("flex items-center gap-3 min-w-0", isCollapsed ? "justify-center" : "")}>
                    <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 text-primary flex items-center justify-center font-bold text-sm shrink-0 shadow-md shadow-primary/5 overflow-hidden">
                        {profile.avatarUrl ? (
                            <Image 
                                src={profile.avatarUrl} 
                                alt={`Avatar de ${profile.fullName}`} 
                                width={40} 
                                height={40} 
                                className="w-full h-full object-cover" 
                                unoptimized 
                            />
                        ) : (
                            profile.fullName.substring(0, 2).toUpperCase()
                        )}
                    </div>
                    <div className={cn("min-w-0 transition-all duration-300 flex-1", isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100 block")}>
                        <div className="flex items-center justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground truncate">{profile.fullName}</p>
                                <p className="text-[10px] text-muted-foreground truncate">@{profile.username}</p>
                            </div>
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 ml-1" aria-hidden="true" />
                        </div>
                    </div>
                </div>

                <Button
                    variant="ghost"
                    className={cn("w-full gap-3 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all rounded-xl", isCollapsed ? "justify-center px-0" : "justify-start px-3")}
                    onClick={() => setLogoutOpen(true)}
                    title={isCollapsed ? t("sidebar.logout") : undefined}
                    aria-label={t("sidebar.logout") || "Cerrar sesión"}
                >
                    <LogOut className="w-5 h-5 shrink-0" aria-hidden="true" />
                    <span className={cn("transition-all duration-300 truncate text-xs font-semibold", isCollapsed ? "w-0 opacity-0 hidden" : "block")}>{t("sidebar.logout")}</span>
                </Button>

                {/* Desktop Collapse Toggle */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="hidden md:flex w-full justify-center text-muted-foreground hover:bg-accent/40 h-8 mt-1 rounded-lg"
                    onClick={toggleCollapse}
                    aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
                    aria-expanded={!isCollapsed}
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" aria-hidden="true" /> : <ChevronLeft className="w-4 h-4" aria-hidden="true" />}
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
                className="fixed top-3 left-4 z-50 md:hidden bg-background/80 backdrop-blur-md border-border/20 shadow-md rounded-xl"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
                aria-expanded={mobileOpen}
            >
                {mobileOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            </Button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar Desktop & Mobile */}
            <aside
                className={cn(
                    "fixed flex flex-col z-50 transition-all duration-300 ease-in-out glass-ios",
                    // Mobile classes
                    mobileOpen ? "translate-x-0 w-64 shadow-2xl top-0 left-0 h-full rounded-none border-r border-border/20" : "-translate-x-full top-0 left-0 h-full rounded-none border-r border-border/20",
                    // Desktop classes (Apple iOS floating widgets layout)
                    "md:translate-x-0 md:top-4 md:left-4 md:h-[calc(100vh-2rem)] md:rounded-2xl md:border md:border-white/10 md:shadow-[0_10px_40px_rgba(0,0,0,0.18)]",
                    isCollapsed ? "md:w-20" : "md:w-64"
                )}
            >
                <NavContent />
            </aside>

            {/* AlertDialog para confirmar Logout */}
            <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
                <AlertDialogContent size="sm" className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogMedia className="bg-red-500/10 text-red-500">
                            <LogOut aria-hidden="true" />
                        </AlertDialogMedia>
                        <AlertDialogTitle>{t("sidebar.logoutConfirmTitle")}</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs">
                            {t("sidebar.logoutConfirmText")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-2">
                        <AlertDialogCancel size="sm" className="text-xs">
                            {t("sidebar.logoutConfirmNo")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            size="sm"
                            onClick={confirmLogout}
                            className="text-xs font-semibold"
                        >
                            {t("sidebar.logoutConfirmYes")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
