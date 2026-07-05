"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Shield, Users, Server, Trash2, Plus, Edit2, Search,
  Power, Copy, Check, LogOut, Loader2, Mail,
  AlertTriangle, LayoutDashboard, Settings, Activity,
  Bell, ChevronLeft, ChevronRight, ExternalLink, X, RefreshCw, Zap
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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

const AvatarCircle = ({ name, color }: { name: string; color: string }) => {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${color}`}>
      {initials}
    </div>
  );
};

const planColors: Record<string, string> = {
  free: "text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300",
  basic: "text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400",
  premium: "text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400",
  custom: "text-purple-700 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400",
};

const avatarColors = [
  "bg-indigo-500", "bg-blue-500", "bg-emerald-500", "bg-violet-500",
  "bg-amber-500", "bg-pink-500", "bg-cyan-500", "bg-teal-500"
];

// SVG Donut Chart Component
const DonutChart = ({ used, total }: { used: number; total: number }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? used / total : 0;
  const strokeDashoffset = circumference - pct * circumference;

  return (
    <div className="relative flex items-center justify-center w-[160px] h-[160px]">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
        {/* Background circle */}
        <circle
          cx="70" cy="70" r={radius}
          fill="transparent"
          stroke="#f3f4f6" // zinc-100
          strokeWidth="12"
        />
        {/* Foreground circle (lime green accent like Cake Equity) */}
        <circle
          cx="70" cy="70" r={radius}
          fill="transparent"
          stroke="#a3e635" // lime-400
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <Server className="w-6 h-6 text-indigo-400 mb-1" />
        <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Usados</span>
      </div>
    </div>
  );
};

export default function SuperAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ username: string; fullName: string; role: string } | null>(null);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Edit / Delete modals
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [targetTenant, setTargetTenant] = useState<Tenant | null>(null);

  const [editName, setEditName] = useState("");
  const [editPlan, setEditPlan] = useState<Tenant["plan"]>("basic");
  const [editMaxServers, setEditMaxServers] = useState(5);
  const [editStatus, setEditStatus] = useState<Tenant["status"]>("active");

  // Users modal
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  
  // Quick Create Form
  const [newName, setNewName] = useState("");
  const [newPlan, setNewPlan] = useState<Tenant["plan"]>("basic");
  const [newMaxServers, setNewMaxServers] = useState(5);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [activationLink, setActivationLink] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/profile");
        if (!res.ok) { router.push("/login"); return; }
        const profile = await res.json();
        if (profile.role !== "superadmin") {
          toast.error("Acceso denegado.");
          router.push("/"); return;
        }
        setUser(profile);
        await loadTenants();
      } catch { router.push("/login"); }
    })();
  }, [router]);

  async function loadTenants() {
    try {
      const res = await fetch("/api/superadmin/tenants");
      if (res.ok) setTenants(await res.json());
    } catch {} finally { setLoading(false); }
  }

  // Handle Quick Create (Simplified for the new layout)
  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newAdminEmail) return;
    setActionLoading(true);
    try {
      const newId = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const adminUsername = newAdminEmail.split("@")[0];
      const r = await fetch("/api/superadmin/tenants", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newId, name: newName, plan: newPlan, maxServers: newMaxServers,
          adminUsername: adminUsername, adminEmail: newAdminEmail, adminFullName: "Admin " + newName
        })
      });
      if (r.ok) {
        const d = await r.json(); toast.success("Inquilino creado exitosamente.");
        setActivationLink(d.activationLink);
        setNewName(""); setNewAdminEmail(""); setNewMaxServers(5); setNewPlan("basic");
        await loadTenants();
      } else { const e = await r.json(); toast.error(e.error || "Error al crear"); }
    } catch { toast.error("Error de conexión"); } finally { setActionLoading(false); }
  };

  const copyToClipboard = () => { if (activationLink) { navigator.clipboard.writeText(activationLink); toast.success("Enlace copiado"); } };

  // Data processing
  const filtered = tenants.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter(t => t.status === "active").length;
  const suspendedTenants = tenants.filter(t => t.status === "suspended").length;
  const totalServersUsed = tenants.reduce((a, t) => a + t.serversCount, 0);
  const MAX_GLOBAL_SERVERS = 1011; // Hardcoded total for the donut chart visual

  // Get Top 3 tenants by server usage for the center card
  const topTenants = [...tenants].sort((a, b) => b.serversCount - a.serversCount).slice(0, 3);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="min-h-screen flex bg-slate-50 text-zinc-900 font-sans">

      {/* ════════════ SIDEBAR ════════════ */}
      <aside className="w-[240px] shrink-0 border-r border-zinc-200 bg-white flex flex-col">
        {/* Logo Area */}
        <div className="px-6 h-[72px] flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="font-bold text-lg tracking-tight">RDPShield</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          <div className="px-2 pb-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">General</div>
          {[
            { icon: LayoutDashboard, label: "Dashboard", active: true },
            { icon: Building2, label: "Inquilinos" },
            { icon: Server, label: "Servidores" },
            { icon: Shield, label: "Licencias" },
          ].map(item => (
            <button key={item.label} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              item.active 
                ? "bg-indigo-50 text-indigo-700" 
                : "text-zinc-600 hover:bg-zinc-50"
            }`}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}

          <div className="px-2 pt-6 pb-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Configuración</div>
          {[
            { icon: Users, label: "Administradores" },
            { icon: Activity, label: "Auditoría" },
            { icon: Settings, label: "Ajustes del Sistema" },
          ].map(item => (
            <button key={item.label} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* What's New / Quick Status Widget (Like Cake Equity) */}
        <div className="p-4 m-4 rounded-xl border border-indigo-100 bg-indigo-50/50">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm mb-3">
            <Zap className="w-4 h-4" />
            Novedades del Sistema
          </div>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between text-xs font-semibold text-zinc-700 hover:text-indigo-600">
              Nuevo Dashboard 🚀 <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            </button>
            <button className="w-full flex items-center justify-between text-xs font-semibold text-zinc-700 hover:text-indigo-600">
              Reportes Mejorados <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            </button>
            <button className="w-full flex items-center justify-between text-xs font-semibold text-zinc-700 hover:text-indigo-600">
              Multitenant Activo <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-100 text-[10px] text-zinc-400 text-center font-mono">
            Versión: v2.4.0-stable
          </div>
        </div>
      </aside>

      {/* ════════════ MAIN CONTENT ════════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header */}
        <header className="h-[72px] bg-white border-b border-zinc-200 flex items-center px-8 shrink-0">
          <div className="flex items-center gap-2 bg-slate-50 border border-zinc-200 rounded-full px-4 py-2 w-[320px]">
            <Search className="w-4 h-4 text-zinc-400" />
            <input 
              placeholder="Buscar empresas, IDs..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-zinc-400"
            />
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-5">
            <button className="relative text-zinc-400 hover:text-zinc-600 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">2</span>
            </button>
            
            <button className="flex items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-indigo-600 transition-colors border border-zinc-200 px-4 py-1.5 rounded-full">
              <LogOut className="w-4 h-4" />
              Salir
            </button>

            <div className="flex items-center gap-3 pl-5 border-l border-zinc-200">
              <div className="text-right">
                <div className="text-sm font-bold text-zinc-900">{user?.fullName || "Super Admin"}</div>
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Operador</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-md shadow-indigo-200">
                SA
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="flex-1 overflow-y-auto p-8 max-w-[1400px] mx-auto w-full space-y-6">
          
          {/* Page Title */}
          <div>
            <h1 className="text-[28px] font-extrabold text-zinc-900 tracking-tight">Panel Principal</h1>
          </div>

          {/* Alert / Banner (Purple style) */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Activity className="w-4 h-4" />
              </div>
              <span className="text-indigo-900 font-medium text-sm">
                Bienvenido al nuevo sistema de Gestión Multitenant. Revisa el uso de recursos global.
              </span>
            </div>
            <button className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-1.5 rounded-full text-xs font-bold transition-colors">
              Ver documentación
            </button>
          </div>

          {/* Top 3-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Column 1: Vertical Stats Stack */}
            <div className="col-span-1 lg:col-span-3 bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm shadow-zinc-100">
              {[
                { label: "Inquilinos Activos", value: activeTenants, icon: Building2, sub: "Cuentas empresariales" },
                { label: "Servidores Globales", value: totalServersUsed, icon: Server, sub: "Conectores RDP activos" },
                { label: "Capacidad Total", value: MAX_GLOBAL_SERVERS, icon: Shield, sub: "Licencias adquiridas" },
                { label: "Cuentas Suspendidas", value: suspendedTenants, icon: Power, sub: "Accesos bloqueados" },
              ].map((stat, i, arr) => (
                <div key={i} className={`p-5 flex items-center gap-4 ${i !== arr.length - 1 ? "border-b border-zinc-100" : ""}`}>
                  <div className="w-10 h-10 rounded-full bg-slate-50 border border-zinc-100 flex items-center justify-center text-zinc-400 shrink-0">
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[22px] font-bold text-zinc-900 leading-none">{stat.value}</div>
                    <div className="text-xs font-semibold text-zinc-500 mt-1">{stat.label}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{stat.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Column 2: Ownership / Top Tenants Card */}
            <div className="col-span-1 lg:col-span-5 bg-white rounded-2xl border border-zinc-200 p-6 flex flex-col shadow-sm shadow-zinc-100">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">Distribución de Recursos</h2>
                  <p className="text-xs text-zinc-500 font-medium">Uso de servidores por inquilino</p>
                </div>
                <button className="text-indigo-600 text-xs font-bold hover:underline">Ver detalle</button>
              </div>

              <div className="flex-1 flex items-center gap-8">
                {/* Donut Chart */}
                <div className="shrink-0">
                   <DonutChart used={totalServersUsed} total={MAX_GLOBAL_SERVERS} />
                </div>

                {/* Top Tenants List */}
                <div className="flex-1 space-y-4">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Top Consumidores</div>
                  {topTenants.length > 0 ? topTenants.map((t, idx) => {
                    const pct = Math.min(100, (t.serversCount / (MAX_GLOBAL_SERVERS || 1)) * 100).toFixed(1);
                    return (
                      <div key={t.id} className="flex items-center gap-3">
                        <AvatarCircle name={t.name} color={avatarColors[idx % avatarColors.length]} />
                        <div className="flex-1">
                          <div className="flex justify-between items-end mb-1.5">
                            <span className="text-sm font-bold text-zinc-900">{t.name}</span>
                            <span className="text-xs font-bold text-zinc-500">{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${idx === 0 ? "bg-lime-400" : "bg-indigo-400"}`} 
                              style={{ width: `${pct}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-xs text-zinc-400">No hay datos suficientes.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Column 3: Quick Action (Activity replacement) */}
            <div className="col-span-1 lg:col-span-4 bg-white rounded-2xl border border-zinc-200 flex flex-col shadow-sm shadow-zinc-100">
              <div className="px-6 pt-6 pb-4 border-b border-zinc-100">
                <h2 className="text-lg font-bold text-zinc-900">Registro Rápido</h2>
                <p className="text-xs text-zinc-500 font-medium">Añadir nueva empresa</p>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-center">
                <form onSubmit={handleQuickCreate} className="space-y-4">
                  <div>
                    <input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre de la empresa" className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-400 font-medium" />
                  </div>
                  <div>
                    <input required type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="Correo del administrador" className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-400 font-medium" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={newPlan} onChange={e => setNewPlan(e.target.value as any)} className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white font-medium">
                      <option value="basic">Plan Básico</option>
                      <option value="premium">Premium</option>
                    </select>
                    <input type="number" min={1} value={newMaxServers} onChange={e => setNewMaxServers(parseInt(e.target.value)||1)} placeholder="Límite" className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-medium tabular-nums" />
                  </div>
                  <button type="submit" disabled={actionLoading} className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear Inquilino"}
                  </button>
                </form>

                {activationLink && (
                  <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center animate-in fade-in slide-in-from-bottom-2">
                    <Check className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                    <div className="text-xs font-bold text-emerald-800 mb-2">¡Creado con éxito!</div>
                    <button onClick={copyToClipboard} className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1 justify-center w-full">
                      <Copy className="w-3 h-3" /> Copiar Enlace de Activación
                    </button>
                  </div>
                )}
              </div>
            </div>
            
          </div>

          {/* Bottom Table Card */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm shadow-zinc-100 overflow-hidden mt-6">
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Directorio de Inquilinos</h2>
                <p className="text-xs text-zinc-500 font-medium">Listado completo de clientes gestionados</p>
              </div>
              <button onClick={() => loadTenants()} className="p-2 border border-zinc-200 rounded-xl text-zinc-500 hover:bg-zinc-50 transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-zinc-100 text-zinc-500 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Empresa</th>
                    <th className="px-6 py-4">Plan</th>
                    <th className="px-6 py-4">Uso de Servidores</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-zinc-400">No se encontraron resultados.</td></tr>
                  ) : filtered.map((t, idx) => {
                    const pct = Math.min(100, (t.serversCount / t.max_servers) * 100);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <AvatarCircle name={t.name} color={avatarColors[idx % avatarColors.length]} />
                            <div>
                              <div className="font-bold text-zinc-900">{t.name}</div>
                              <div className="text-xs text-zinc-400 font-medium mt-0.5">{t.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${planColors[t.plan] || planColors.basic}`}>
                            {t.plan}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3 max-w-[180px]">
                            <div className="flex-1">
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                            <span className="text-xs font-bold text-zinc-600 tabular-nums">{t.serversCount}/{t.max_servers}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${t.status === 'active' ? 'text-emerald-600' : 'text-red-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            {t.status === 'active' ? 'Activo' : 'Suspendido'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Users className="w-4 h-4" /></button>
                            <button className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Settings className="w-4 h-4" /></button>
                            <button className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Simple Pagination footer */}
            <div className="px-6 py-4 border-t border-zinc-100 bg-slate-50 flex items-center justify-between text-xs font-medium text-zinc-500">
              <span>Total: {filtered.length} inquilinos</span>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg hover:border-zinc-300">Anterior</button>
                <button className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg hover:border-zinc-300">Siguiente</button>
              </div>
            </div>
          </div>
          
        </main>
      </div>
    </div>
  );
}
