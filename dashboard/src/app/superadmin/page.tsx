"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Shield, Users, Server, Trash2, Plus, Edit2, Search,
  Power, Copy, Check, LogOut, Loader2, Mail,
  AlertTriangle, LayoutDashboard, Settings, Activity,
  Minus, Bell, CheckCircle2, ChevronLeft, X, RefreshCw, Filter,
  MoreVertical, Headphones, ChevronRight, ExternalLink, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'expired';
  plan: 'free' | 'basic' | 'premium' | 'custom';
  max_servers: number;
  expires_at: string | null;
  domain: string | null;
  created_at: string;
  usersCount: number;
  serversCount: number;
}

/* ── tiny sparkline ── */
const Spark = ({ d, color }: { d: number[]; color: string }) => {
  const w = 80, h = 22;
  const mx = Math.max(...d, 1), mn = Math.min(...d, 0), r = mx - mn || 1;
  const pts = d.map((v, i) => `${(i / (d.length - 1)) * w},${h - 2 - ((v - mn) / r) * (h - 4)}`).join(" ");
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
};

/* ── avatar circle with initials ── */
const AvatarCircle = ({ name, color }: { name: string; color: string }) => {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${color}`}>
      {initials}
    </div>
  );
};

const planColors: Record<string, string> = {
  free: "text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300",
  basic: "text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400",
  premium: "text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400",
  custom: "text-purple-700 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400",
};

const avatarColors = [
  "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-violet-500",
  "bg-pink-500", "bg-teal-500", "bg-amber-500", "bg-cyan-500"
];

export default function SuperAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ username: string; fullName: string; role: string } | null>(null);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [targetTenant, setTargetTenant] = useState<Tenant | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [activationLink, setActivationLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Create form
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPlan, setNewPlan] = useState<Tenant["plan"]>("basic");
  const [newMaxServers, setNewMaxServers] = useState(5);
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminFullName, setNewAdminFullName] = useState("");

  // Edit form
  const [editName, setEditName] = useState("");
  const [editPlan, setEditPlan] = useState<Tenant["plan"]>("basic");
  const [editMaxServers, setEditMaxServers] = useState(5);
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [editStatus, setEditStatus] = useState<Tenant["status"]>("active");

  // User modals
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [isUserCreateOpen, setIsUserCreateOpen] = useState(false);
  const [userNewUsername, setUserNewUsername] = useState("");
  const [userNewEmail, setUserNewEmail] = useState("");
  const [userNewFullName, setUserNewFullName] = useState("");
  const [userNewRole, setUserNewRole] = useState<"admin" | "viewer">("viewer");
  const [isUserEditOpen, setIsUserEditOpen] = useState(false);
  const [userTargetUser, setUserTargetUser] = useState<any | null>(null);
  const [userEditFullName, setUserEditFullName] = useState("");
  const [userEditUsername, setUserEditUsername] = useState("");
  const [userEditRole, setUserEditRole] = useState<"admin" | "viewer">("viewer");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  /* ── auth ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/profile");
        if (!res.ok) { router.push("/login"); return; }
        const profile = await res.json();
        if (profile.role !== "superadmin") {
          toast.error("Acceso denegado. Se requiere cuenta de Super Administrador.");
          router.push("/"); return;
        }
        const licRes = await fetch("/api/license/status");
        if (licRes.ok) { const lic = await licRes.json(); if (!lic.valid) { router.push("/license"); return; } }
        setUser(profile);
        await loadTenants();
      } catch { router.push("/login"); }
    })();
  }, [router]);

  async function loadTenants() {
    try {
      const res = await fetch("/api/superadmin/tenants");
      if (res.ok) setTenants(await res.json());
      else toast.error("Error al cargar inquilinos");
    } catch { toast.error("Error al conectar con la API"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (newName) setNewId(newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  }, [newName]);

  /* ── tenant CRUD ── */
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newName || !newAdminUsername || !newAdminEmail || !newAdminFullName) { toast.error("Completa los campos requeridos."); return; }
    setActionLoading(true);
    try {
      const r = await fetch("/api/superadmin/tenants", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId.trim(), name: newName.trim(), plan: newPlan, maxServers: newMaxServers,
          expiresAt: newExpiresAt ? new Date(newExpiresAt).toISOString() : null, domain: newDomain ? newDomain.trim() : null,
          adminUsername: newAdminUsername.trim(), adminEmail: newAdminEmail.trim(), adminFullName: newAdminFullName.trim() }) });
      if (r.ok) {
        const d = await r.json(); toast.success(`Inquilino "${newName}" creado.`);
        setActivationLink(d.activationLink);
        setNewId(""); setNewName(""); setNewPlan("basic"); setNewMaxServers(5);
        setNewExpiresAt(""); setNewDomain(""); setNewAdminUsername(""); setNewAdminEmail(""); setNewAdminFullName("");
        await loadTenants();
      } else { const e = await r.json(); toast.error(e.error || "Error al crear"); }
    } catch { toast.error("Error de conexión"); } finally { setActionLoading(false); }
  };

  const toggleStatus = async (t: Tenant) => {
    const next = t.status === "active" ? "suspended" : "active";
    try {
      const r = await fetch("/api/superadmin/tenants", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, status: next }) });
      if (r.ok) { toast.success(`${t.name} ${next === "active" ? "activado" : "suspendido"}.`); await loadTenants(); }
      else { const e = await r.json(); toast.error(e.error || "Error"); }
    } catch { toast.error("Error de conexión"); }
  };

  const openEditModal = (t: Tenant) => { setTargetTenant(t); setEditName(t.name); setEditPlan(t.plan); setEditMaxServers(t.max_servers); setEditExpiresAt(t.expires_at ? t.expires_at.split("T")[0] : ""); setEditDomain(t.domain || ""); setEditStatus(t.status); setIsEditOpen(true); };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault(); if (!targetTenant) return; setActionLoading(true);
    try {
      const r = await fetch("/api/superadmin/tenants", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: targetTenant.id, name: editName.trim(), plan: editPlan, maxServers: editMaxServers,
          expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null, domain: editDomain ? editDomain.trim() : null, status: editStatus }) });
      if (r.ok) { toast.success(`${editName} actualizado.`); setIsEditOpen(false); await loadTenants(); }
      else { const e = await r.json(); toast.error(e.error || "Error"); }
    } catch { toast.error("Error de red"); } finally { setActionLoading(false); }
  };

  const openDeleteModal = (t: Tenant) => { setTargetTenant(t); setIsDeleteOpen(true); };

  const handleDeleteTenant = async () => {
    if (!targetTenant) return; setActionLoading(true);
    try {
      const r = await fetch(`/api/superadmin/tenants?id=${targetTenant.id}`, { method: "DELETE" });
      if (r.ok) { toast.success(`${targetTenant.name} eliminado.`); setIsDeleteOpen(false); await loadTenants(); }
      else { const e = await r.json(); toast.error(e.error || "Error"); }
    } catch { toast.error("Error de red"); } finally { setActionLoading(false); }
  };

  /* ── user CRUD ── */
  const openUsersModal = async (t: Tenant) => { setTargetTenant(t); setIsUsersOpen(true); await loadTenantUsers(t.id); };
  const loadTenantUsers = async (tid: string) => { setUsersLoading(true); try { const r = await fetch(`/api/superadmin/users?tenantId=${tid}`); if (r.ok) { const d = await r.json(); setTenantUsers(d.users || []); } } catch {} finally { setUsersLoading(false); } };
  const handleUserInvite = async (e: React.FormEvent) => {
    e.preventDefault(); if (!targetTenant) return; setActionLoading(true);
    try {
      const r = await fetch("/api/superadmin/users", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: targetTenant.id, username: userNewUsername, email: userNewEmail, fullName: userNewFullName, role: userNewRole }) });
      const d = await r.json();
      if (r.ok) { toast.success("Usuario invitado"); setIsUserCreateOpen(false); setUserNewUsername(""); setUserNewEmail(""); setUserNewFullName(""); setUserNewRole("viewer"); await loadTenantUsers(targetTenant.id); await loadTenants(); }
      else toast.error(d.error || "Error");
    } catch { toast.error("Error de conexión"); } finally { setActionLoading(false); }
  };
  const openUserEditModal = (u: any) => { setUserTargetUser(u); setUserEditFullName(u.fullName); setUserEditUsername(u.username); setUserEditRole(u.role); setIsUserEditOpen(true); };
  const handleUserEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!targetTenant || !userTargetUser) return; setActionLoading(true);
    try {
      const r = await fetch(`/api/superadmin/users/${userTargetUser.id}`, { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: targetTenant.id, fullName: userEditFullName, role: userEditRole, username: userEditUsername }) });
      if (r.ok) { toast.success("Usuario actualizado"); setIsUserEditOpen(false); await loadTenantUsers(targetTenant.id); }
      else { const d = await r.json(); toast.error(d.error || "Error"); }
    } catch { toast.error("Error"); } finally { setActionLoading(false); }
  };
  const handleUserDelete = async (u: any) => {
    if (!targetTenant || !confirm(`¿Eliminar a @${u.username}?`)) return; setActionLoading(true);
    try { const r = await fetch(`/api/superadmin/users/${u.id}?tenantId=${targetTenant.id}`, { method: "DELETE" }); if (r.ok) { toast.success("Eliminado"); await loadTenantUsers(targetTenant.id); await loadTenants(); } else { const d = await r.json(); toast.error(d.error || "Error"); } } catch { toast.error("Error"); } finally { setActionLoading(false); }
  };
  const handleUserResendInvite = async (u: any) => {
    if (!targetTenant) return;
    try { const r = await fetch(`/api/superadmin/users/${u.id}/resend-invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: targetTenant.id }) }); if (r.ok) toast.success("Invitación reenviada"); else { const d = await r.json(); toast.error(d.error || "Error"); } } catch { toast.error("Error"); }
  };
  const copyToClipboard = () => { if (activationLink) { navigator.clipboard.writeText(activationLink); setCopied(true); toast.success("Enlace copiado"); setTimeout(() => setCopied(false), 2000); } };

  /* ── filters / pagination ── */
  const filtered = tenants.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchQ = t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || (t.domain?.toLowerCase().includes(q));
    return (statusFilter === "all" || t.status === statusFilter) && matchQ;
  });
  const total = tenants.length;
  const active = tenants.filter(t => t.status === "active").length;
  const suspended = tenants.filter(t => t.status === "suspended").length;
  const servers = tenants.reduce((a, t) => a + t.serversCount, 0);
  const maxPage = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">

      {/* ════════════ SIDEBAR ════════════ */}
      <aside className="w-[220px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
        {/* Logo */}
        <div className="px-5 h-[60px] flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-bold">ECA Soluciones</div>
            <div className="text-[10px] text-zinc-400 font-medium">SaaS Operator</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-5 space-y-0.5">
          <div className="px-3 pb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Plataforma</div>
          {[
            { icon: LayoutDashboard, label: "Dashboard", active: true },
            { icon: Building2, label: "Inquilinos" },
            { icon: Server, label: "Servidores" },
            { icon: Shield, label: "Licencias" },
            { icon: Power, label: "Suspensiones" },
            { icon: Activity, label: "Auditoría" },
            { icon: Settings, label: "Configuración" },
          ].map(item => (
            <button key={item.label} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              item.active ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}>
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 space-y-1 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <div className="flex-1 text-left">
              <div>Estado del Sistema</div>
              <div className="text-[10px] text-zinc-400">Todos los servicios operativos</div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium">
            <Headphones className="w-[18px] h-[18px]" />
            Soporte
          </button>
        </div>
      </aside>

      {/* ════════════ MAIN AREA ════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="h-[60px] border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center px-6 gap-4 shrink-0">
          <button onClick={() => router.push("/")} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="leading-tight">
            <div className="text-[15px] font-bold">Panel de Super Administrador</div>
            <div className="text-[11px] text-zinc-400">Bienvenido, {user?.fullName || "Super Administrador"}</div>
          </div>
          <div className="flex-1" />

          {/* Search */}
          <div className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 w-[280px] bg-zinc-50 dark:bg-zinc-800">
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <input
              placeholder="Buscar inquilino, empresa, dominio..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-xs flex-1 outline-none placeholder:text-zinc-400"
            />
            <kbd className="hidden sm:inline text-[9px] text-zinc-400 border border-zinc-200 dark:border-zinc-600 rounded px-1 py-0.5 font-mono">⌘ K</kbd>
          </div>

          <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 relative">
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">3</span>
          </button>

          <div className="flex items-center gap-2.5 pl-2 border-l border-zinc-200 dark:border-zinc-700 ml-1">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 font-bold text-xs flex items-center justify-center">SA</div>
            <div className="text-right leading-tight hidden md:block">
              <div className="text-[12px] font-semibold">{user?.fullName || "Super Administrador"}</div>
              <div className="text-[10px] text-zinc-400">superadmin</div>
            </div>
            <button
              onClick={() => { document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;"; router.push("/login"); }}
              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 flex overflow-hidden">

          {/* ════════════ CENTER ════════════ */}
          <main className="flex-1 overflow-y-auto p-6 space-y-5 min-w-0">

            {/* Top action bar */}
            <div className="flex items-center justify-between">
              <div />
              <button onClick={() => setRightPanelOpen(true)} className="h-9 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 active:scale-[0.98]">
                <Plus className="w-4 h-4" /> Nuevo Inquilino
              </button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Total Inquilinos", value: total, desc: "Cuentas SaaS registradas", spark: [2,3,2,4,3,5,4,6], color: "#3b82f6", iconBg: "bg-blue-50 dark:bg-blue-900/30", iconColor: "text-blue-500" },
                { label: "Licencias Activas", value: active, desc: "Empresas en servicio activo", spark: [3,4,3,3,4,5,5,5], color: "#10b981", iconBg: "bg-emerald-50 dark:bg-emerald-900/30", iconColor: "text-emerald-500" },
                { label: "Clientes Suspendidos", value: suspended, desc: "Accesos revocados o suspendidos", spark: [0,0,1,0,0,0,0,0], color: "#f97316", iconBg: "bg-orange-50 dark:bg-orange-900/30", iconColor: "text-orange-500" },
                { label: "Servidores Totales", value: servers, desc: "Conectores RDP activos", spark: [1,1,2,2,3,2,3,4], color: "#8b5cf6", iconBg: "bg-violet-50 dark:bg-violet-900/30", iconColor: "text-violet-500" },
              ].map((c, i) => (
                <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col justify-between min-h-[120px]">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[11px] text-zinc-500 font-medium">{c.label}</div>
                      <div className="text-[28px] font-bold leading-tight mt-0.5">{c.value}</div>
                    </div>
                    <div className={`w-9 h-9 rounded-full ${c.iconBg} ${c.iconColor} flex items-center justify-center`}>
                      {i === 0 && <Building2 className="w-4 h-4" />}
                      {i === 1 && <Shield className="w-4 h-4" />}
                      {i === 2 && <Power className="w-4 h-4" />}
                      {i === 3 && <Server className="w-4 h-4" />}
                    </div>
                  </div>
                  <div className="flex items-end justify-between mt-2">
                    <span className="text-[10px] text-zinc-400">{c.desc}</span>
                    <Spark d={c.spark} color={c.color} />
                  </div>
                </div>
              ))}
            </div>

            {/* Table card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              {/* Table toolbar */}
              <div className="px-5 py-3.5 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="relative flex-1 max-w-[280px]">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    placeholder="Buscar inquilino por nombre, ID o dominio..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-9 pr-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 outline-none focus:border-blue-400 transition-colors"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-800 outline-none h-[30px] font-medium"
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activo</option>
                  <option value="suspended">Suspendido</option>
                </select>
                <button className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium h-[30px]">
                  <Filter className="w-3 h-3" /> Filtros
                </button>
                <button onClick={() => loadTenants()} className="p-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 h-[30px] w-[30px] flex items-center justify-center">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Table */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500">
                    <th className="text-left px-5 py-2.5 font-semibold text-[11px]">INQUILINO / EMPRESA</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-[11px]">SERVIDORES / LÍMITE</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-[11px]">PLAN / EXPIRACIÓN</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-[11px]">ESTADO</th>
                    <th className="text-right px-5 py-2.5 font-semibold text-[11px]">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-16 text-zinc-400">No se encontraron inquilinos.</td></tr>
                  ) : paginated.map((t, idx) => {
                    const pct = Math.min(100, (t.serversCount / t.max_servers) * 100);
                    const full = t.serversCount >= t.max_servers;
                    return (
                      <tr key={t.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <AvatarCircle name={t.name} color={avatarColors[idx % avatarColors.length]} />
                            <div>
                              <div className="font-semibold text-[13px]">{t.name}</div>
                              <div className="text-[11px] text-zinc-400 mt-0.5">ID: {t.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="space-y-1 max-w-[160px]">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{t.serversCount} de {t.max_servers}</span>
                              <span className="text-zinc-400">Servidores monitoreados</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${full ? "bg-amber-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className={`text-[10px] font-semibold ${full ? "text-amber-500" : "text-zinc-400"}`}>{Math.round(pct)}%</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${planColors[t.plan] || planColors.basic}`}>
                            {t.plan}
                          </span>
                          <div className="text-[10px] text-zinc-400 mt-1">{t.expires_at ? `Expira: ${new Date(t.expires_at).toLocaleDateString()}` : "Sin fecha límite"}</div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            t.status === "active" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${t.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                            {t.status === "active" ? "Activo" : "Suspendido"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => toggleStatus(t)} title={t.status === "active" ? "Suspender" : "Activar"} className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 ${t.status === "active" ? "text-amber-500" : "text-emerald-500"}`}><Power className="w-4 h-4" /></button>
                            <button onClick={() => openUsersModal(t)} title="Usuarios" className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"><Users className="w-4 h-4" /></button>
                            <button onClick={() => openEditModal(t)} title="Editar" className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => openDeleteModal(t)} title="Eliminar" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="px-5 py-3 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400">
                <span>Mostrando {Math.min(filtered.length, (currentPage - 1) * itemsPerPage + 1)} a {Math.min(currentPage * itemsPerPage, filtered.length)} de {filtered.length} resultados</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {Array.from({ length: maxPage }, (_, i) => (
                    <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold ${
                      currentPage === i + 1 ? "bg-blue-600 text-white" : "border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}>{i + 1}</button>
                  ))}
                  <button onClick={() => setCurrentPage(p => Math.min(maxPage, p + 1))} disabled={currentPage === maxPage} className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Activation link banner */}
            {activationLink && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="text-sm font-semibold text-blue-900 dark:text-blue-300">¡Inquilino creado exitosamente!</div>
                  <p className="text-xs text-blue-700 dark:text-blue-400">Envía este enlace al administrador del cliente para activar su cuenta:</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={activationLink} className="flex-1 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-700 rounded-lg text-xs font-mono select-all" />
                    <Button onClick={copyToClipboard} size="sm" variant="outline" className="h-8 text-xs gap-1 rounded-lg border-blue-300">
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* ════════════ RIGHT PANEL ════════════ */}
          <aside className={`w-[320px] shrink-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto transition-all ${rightPanelOpen ? "" : "hidden"}`}>
            <div className="p-5 space-y-5">

              {/* ── Create tenant section ── */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Plus className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-[12px] font-bold text-white">Nuevo Inquilino</div>
                      <div className="text-[10px] text-blue-200">Registro rápido de empresa</div>
                    </div>
                  </div>
                  <button onClick={() => setRightPanelOpen(false)} className="p-1 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Form body */}
                <form onSubmit={handleCreateTenant} className="p-4 space-y-3.5">
                  {/* Company name */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                      <Building2 className="w-3 h-3" /> Empresa
                    </label>
                    <input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      required
                      placeholder="Ej. Claro Telecom"
                      className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-zinc-400"
                    />
                    {newId && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
                        <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono">{newId}</span>
                        <span>· ID auto-generado</span>
                      </div>
                    )}
                  </div>

                  {/* Plan + servers */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                        <Shield className="w-3 h-3" /> Plan
                      </label>
                      <select
                        value={newPlan}
                        onChange={e => setNewPlan(e.target.value as Tenant["plan"])}
                        className="w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-medium appearance-none cursor-pointer"
                      >
                        <option value="free">🆓 Free</option>
                        <option value="basic">⭐ Basic</option>
                        <option value="premium">💎 Premium</option>
                        <option value="custom">🔧 Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                        <Server className="w-3 h-3" /> Servidores
                      </label>
                      <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                        <button type="button" onClick={() => setNewMaxServers(Math.max(1, newMaxServers - 1))} className="px-2 py-2.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={newMaxServers}
                          onChange={e => setNewMaxServers(parseInt(e.target.value) || 1)}
                          className="flex-1 py-2.5 text-xs bg-transparent outline-none text-center font-bold tabular-nums"
                        />
                        <button type="button" onClick={() => setNewMaxServers(newMaxServers + 1)} className="px-2 py-2.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Admin info */}
                  <div className="pt-1">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                      <Users className="w-3 h-3" /> Administrador
                    </label>
                    <div className="space-y-2">
                      <input
                        value={newAdminFullName}
                        onChange={e => setNewAdminFullName(e.target.value)}
                        required
                        placeholder="Nombre completo"
                        className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-zinc-400"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={newAdminUsername}
                          onChange={e => setNewAdminUsername(e.target.value)}
                          required
                          placeholder="Usuario"
                          className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-zinc-400"
                        />
                        <input
                          value={newAdminEmail}
                          onChange={e => setNewAdminEmail(e.target.value)}
                          required
                          type="email"
                          placeholder="email@empresa.com"
                          className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-zinc-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="pt-2 space-y-2">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Crear Inquilino
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="w-full h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300 flex items-center justify-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all duration-200 active:scale-[0.98]"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Configuración avanzada
                    </button>
                  </div>
                </form>
              </div>

              {/* ── Platform summary ── */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[12px] font-bold">Resumen de plataforma</span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {[
                    { icon: Building2, label: "Empresas activas", value: active, total: total, barColor: "bg-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
                    { icon: Server, label: "Servidores en uso", value: servers, total: total * 5 || 10, barColor: "bg-violet-500", bgColor: "bg-violet-100 dark:bg-violet-900/30" },
                    { icon: Shield, label: "Licencias operativas", value: active, total: total, barColor: "bg-emerald-500", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
                    { icon: Power, label: "Suspensiones", value: suspended, total: total, barColor: "bg-red-500", bgColor: "bg-red-100 dark:bg-red-900/30" },
                  ].map((item, i) => {
                    const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
                    return (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">
                            <div className={`w-5 h-5 rounded-md ${item.bgColor} flex items-center justify-center`}>
                              <item.icon className="w-3 h-3" />
                            </div>
                            {item.label}
                          </div>
                          <span className="text-[12px] font-bold tabular-nums">{item.value}<span className="text-zinc-400 font-normal">/{item.total}</span></span>
                        </div>
                        <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${item.barColor} transition-all duration-500`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800">
                  <button className="w-full flex items-center justify-center gap-1.5 text-[11px] text-blue-600 font-semibold hover:text-blue-700 transition-colors py-1">
                    Ver reporte completo
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* ── Quick stats ── */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 text-center hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-default">
                  <div className="text-[20px] font-bold text-blue-600">{total}</div>
                  <div className="text-[10px] text-zinc-400 font-medium mt-0.5">Tenants</div>
                </div>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 text-center hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-default">
                  <div className="text-[20px] font-bold text-emerald-600">{Math.round((active / (total || 1)) * 100)}%</div>
                  <div className="text-[10px] text-zinc-400 font-medium mt-0.5">Uptime</div>
                </div>
              </div>

            </div>
          </aside>

        </div>
      </div>

      {/* ════════════ MODALS ════════════ */}

      {/* Edit tenant */}
      {isEditOpen && targetTenant && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <div><h3 className="text-sm font-bold">Editar: {targetTenant.name}</h3><p className="text-[11px] text-zinc-400">ID: {targetTenant.id}</p></div>
              <button onClick={() => setIsEditOpen(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleUpdateTenant} className="space-y-3">
              <div><label className="text-[11px] font-medium text-zinc-500 block mb-1">Nombre</label><input required value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 block mb-1">Plan</label><select value={editPlan} onChange={e => setEditPlan(e.target.value as Tenant["plan"])} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none"><option value="free">Free</option><option value="basic">Basic</option><option value="premium">Premium</option><option value="custom">Custom</option></select></div>
                <div><label className="text-[11px] font-medium text-zinc-500 block mb-1">Servidores</label><input type="number" min={1} value={editMaxServers} onChange={e => setEditMaxServers(parseInt(e.target.value))} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 block mb-1">Expiración</label><input type="date" value={editExpiresAt} onChange={e => setEditExpiresAt(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 block mb-1">Estado</label><select value={editStatus} onChange={e => setEditStatus(e.target.value as Tenant["status"])} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none"><option value="active">Activo</option><option value="suspended">Suspendido</option></select></div>
              </div>
              <div><label className="text-[11px] font-medium text-zinc-500 block mb-1">Dominio</label><input value={editDomain} onChange={e => setEditDomain(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none" /></div>
              <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)} className="h-8 text-xs">Cancelar</Button><Button type="submit" disabled={actionLoading} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">{actionLoading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}Guardar</Button></div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {isDeleteOpen && targetTenant && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-6 animate-in zoom-in-95">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full"><AlertTriangle className="w-5 h-5" /></div>
              <div><h3 className="text-sm font-bold">¿Eliminar {targetTenant.name}?</h3><p className="text-xs text-zinc-500 mt-1">Esta acción es irreversible. Se eliminarán todos los datos asociados.</p></div>
            </div>
            <div className="space-y-3">
              <div className="bg-zinc-50 dark:bg-zinc-800 p-2.5 rounded-lg text-xs text-center font-mono">Escribe <b>{targetTenant.id}</b> para confirmar</div>
              <input id="deleteConfirmInput" placeholder="ID del inquilino" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-center font-mono outline-none" />
              <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setIsDeleteOpen(false)} className="h-8 text-xs">Cancelar</Button><Button variant="destructive" disabled={actionLoading} onClick={() => { const inp = document.getElementById("deleteConfirmInput") as HTMLInputElement; if (inp?.value === targetTenant.id) handleDeleteTenant(); else toast.error("ID no coincide"); }} className="h-8 text-xs">{actionLoading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}Eliminar</Button></div>
            </div>
          </div>
        </div>
      )}

      {/* Users modal */}
      {isUsersOpen && targetTenant && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-[80vh] flex flex-col p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-3">
              <div><h3 className="text-sm font-bold">Usuarios: {targetTenant.name}</h3><p className="text-[11px] text-zinc-400">ID: {targetTenant.id}</p></div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setIsUserCreateOpen(true)} size="sm" className="h-8 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"><Plus className="w-3 h-3" />Invitar</Button>
                <button onClick={() => setIsUsersOpen(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {usersLoading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
              : tenantUsers.length === 0 ? <div className="text-center py-12 text-zinc-400 text-xs">No hay usuarios registrados.</div>
              : <table className="w-full text-xs"><thead><tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400"><th className="text-left px-4 py-2">Nombre</th><th className="text-left px-4 py-2">Usuario</th><th className="text-left px-4 py-2">Rol</th><th className="text-left px-4 py-2">Estado</th><th className="text-right px-4 py-2">Acciones</th></tr></thead>
                <tbody>{tenantUsers.map(u => (
                  <tr key={u.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-4 py-2.5 font-semibold">{u.fullName}</td>
                    <td className="px-4 py-2.5"><div className="font-mono">@{u.username}</div><div className="text-zinc-400 text-[10px]">{u.email}</div></td>
                    <td className="px-4 py-2.5"><span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${u.role === "admin" ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>{u.role === "admin" ? "Admin" : "Viewer"}</span></td>
                    <td className="px-4 py-2.5"><span className={`text-[10px] font-semibold ${u.pending ? "text-amber-500" : "text-emerald-500"}`}>{u.pending ? "Pendiente" : "Activo"}</span></td>
                    <td className="px-4 py-2.5 text-right"><div className="flex justify-end gap-0.5">
                      {u.pending && <button onClick={() => handleUserResendInvite(u)} className="p-1 rounded text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"><Mail className="w-3.5 h-3.5" /></button>}
                      <button onClick={() => openUserEditModal(u)} className="p-1 rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleUserDelete(u)} className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div></td>
                  </tr>
                ))}</tbody></table>}
            </div>
          </div>
        </div>
      )}

      {/* User invite modal */}
      {isUserCreateOpen && targetTenant && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-bold">Invitar usuario</h3><button onClick={() => setIsUserCreateOpen(false)} className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400"><X className="w-4 h-4" /></button></div>
            <form onSubmit={handleUserInvite} className="space-y-3">
              <div><label className="text-[11px] font-medium text-zinc-500 block mb-1">Usuario</label><input required placeholder="juan.perez" value={userNewUsername} onChange={e => setUserNewUsername(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none" /></div>
              <div><label className="text-[11px] font-medium text-zinc-500 block mb-1">Nombre completo</label><input required placeholder="Juan Pérez" value={userNewFullName} onChange={e => setUserNewFullName(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none" /></div>
              <div><label className="text-[11px] font-medium text-zinc-500 block mb-1">Correo</label><input required type="email" placeholder="juan@empresa.com" value={userNewEmail} onChange={e => setUserNewEmail(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none" /></div>
              <div><label className="text-[11px] font-medium text-zinc-500 block mb-1">Rol</label><select value={userNewRole} onChange={e => setUserNewRole(e.target.value as "admin" | "viewer")} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none"><option value="viewer">Visualizador</option><option value="admin">Administrador</option></select></div>
              <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setIsUserCreateOpen(false)} className="h-8 text-xs">Cancelar</Button><Button type="submit" disabled={actionLoading} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">{actionLoading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}Invitar</Button></div>
            </form>
          </div>
        </div>
      )}

      {/* User edit modal */}
      {isUserEditOpen && targetTenant && userTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-bold">Editar: @{userTargetUser.username}</h3><button onClick={() => setIsUserEditOpen(false)} className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400"><X className="w-4 h-4" /></button></div>
            <form onSubmit={handleUserEdit} className="space-y-3">
              <div><label className="text-[11px] font-medium text-zinc-500 block mb-1">Usuario</label><input required value={userEditUsername} onChange={e => setUserEditUsername(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none" /></div>
              <div><label className="text-[11px] font-medium text-zinc-500 block mb-1">Nombre</label><input required value={userEditFullName} onChange={e => setUserEditFullName(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none" /></div>
              <div><label className="text-[11px] font-medium text-zinc-500 block mb-1">Rol</label><select value={userEditRole} onChange={e => setUserEditRole(e.target.value as "admin" | "viewer")} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none"><option value="viewer">Visualizador</option><option value="admin">Administrador</option></select></div>
              <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setIsUserEditOpen(false)} className="h-8 text-xs">Cancelar</Button><Button type="submit" disabled={actionLoading} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">{actionLoading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}Guardar</Button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
