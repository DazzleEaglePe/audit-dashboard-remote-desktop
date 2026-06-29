"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, Shield, Users, Server, Trash2, Plus, Edit2, Search, 
  Power, Copy, Check, LogOut, Loader2, Calendar, ArrowLeft, Mail, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
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

export default function SuperAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ username: string; fullName: string; role: string } | null>(null);
  
  // Data States
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  // Active/Target Tenant
  const [targetTenant, setTargetTenant] = useState<Tenant | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Onboarding Result Link
  const [activationLink, setActivationLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form States (Create)
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPlan, setNewPlan] = useState<Tenant['plan']>("basic");
  const [newMaxServers, setNewMaxServers] = useState(5);
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminFullName, setNewAdminFullName] = useState("");

  // Form States (Edit)
  const [editName, setEditName] = useState("");
  const [editPlan, setEditPlan] = useState<Tenant['plan']>("basic");
  const [editMaxServers, setEditMaxServers] = useState(5);
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [editStatus, setEditStatus] = useState<Tenant['status']>("active");

  const pageRef = useRef<HTMLDivElement>(null);

  // 1. Authenticate and check role
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/profile");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const profile = await res.json();
        if (profile.role !== "superadmin") {
          toast.error("Acceso denegado. Se requiere cuenta de Super Administrador.");
          router.push("/");
          return;
        }

        // Check license status
        const licRes = await fetch("/api/license/status");
        if (licRes.ok) {
          const lic = await licRes.json();
          if (!lic.valid) {
            router.push("/license");
            return;
          }
        }

        setUser(profile);
        await loadTenants();
      } catch (err) {
        console.error(err);
        router.push("/login");
      }
    }
    checkAuth();
  }, [router]);

  // Load Tenants list
  async function loadTenants() {
    try {
      const res = await fetch("/api/superadmin/tenants");
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      } else {
        toast.error("Error al cargar la lista de inquilinos");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al conectar con la API");
    } finally {
      setLoading(false);
    }
  }

  // Auto-generate slug ID from tenant name
  useEffect(() => {
    if (!newId && newName) {
      const slug = newName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setNewId(slug);
    }
  }, [newName, newId]);

  // GSAP Entrance
  useGSAP(() => {
    if (!loading && pageRef.current) {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          pageRef.current!,
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }
        );
      });
    }
  }, { dependencies: [loading], scope: pageRef });

  // Handle Logout
  const handleLogout = () => {
    document.cookie = "auth-token=; path=/; max-age=0";
    router.push("/login");
    router.refresh();
  };

  // Copy activation link
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Enlace de activación copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle Create Tenant Submission
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActivationLink(null);

    try {
      const response = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newId,
          name: newName,
          plan: newPlan,
          max_servers: newMaxServers,
          expires_at: newExpiresAt || null,
          domain: newDomain || null,
          adminUsername: newAdminUsername,
          adminEmail: newAdminEmail,
          adminFullName: newAdminFullName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setActivationLink(data.activationLink);
        toast.success(`Inquilino ${newName} creado con éxito.`);
        
        // Reset forms
        setNewId("");
        setNewName("");
        setNewPlan("basic");
        setNewMaxServers(5);
        setNewExpiresAt("");
        setNewDomain("");
        setNewAdminUsername("");
        setNewAdminEmail("");
        setNewAdminFullName("");

        await loadTenants();
      } else {
        const err = await response.json();
        toast.error(err.error || "Error al crear el inquilino");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error de red al crear el inquilino");
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Modal and prefill
  const openEditModal = (tenant: Tenant) => {
    setTargetTenant(tenant);
    setEditName(tenant.name);
    setEditPlan(tenant.plan);
    setEditMaxServers(tenant.max_servers);
    setEditExpiresAt(tenant.expires_at ? tenant.expires_at.slice(0, 10) : "");
    setEditDomain(tenant.domain || "");
    setEditStatus(tenant.status);
    setIsEditOpen(true);
  };

  // Handle Update Tenant Submission
  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTenant) return;
    setActionLoading(true);

    try {
      const response = await fetch("/api/superadmin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetTenant.id,
          name: editName,
          plan: editPlan,
          max_servers: editMaxServers,
          expires_at: editExpiresAt || null,
          domain: editDomain || null,
          status: editStatus,
        }),
      });

      if (response.ok) {
        toast.success("Inquilino actualizado con éxito");
        setIsEditOpen(false);
        await loadTenants();
      } else {
        const err = await response.json();
        toast.error(err.error || "Error al actualizar");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error de red al actualizar");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle tenant status directly (Suspender / Reactivar)
  const toggleTenantStatus = async (tenant: Tenant) => {
    const nextStatus = tenant.status === "active" ? "suspended" : "active";
    const statusLabel = nextStatus === "active" ? "reactivado" : "suspendido";
    
    try {
      const response = await fetch("/api/superadmin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tenant.id,
          status: nextStatus,
        }),
      });

      if (response.ok) {
        toast.success(`Inquilino ${tenant.name} ${statusLabel} con éxito`);
        await loadTenants();
      } else {
        const err = await response.json();
        toast.error(err.error || "Error al cambiar estado");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error de red");
    }
  };

  // Open Delete Confirm Modal
  const openDeleteModal = (tenant: Tenant) => {
    setTargetTenant(tenant);
    setIsDeleteOpen(true);
  };

  // Handle Delete Tenant
  const handleDeleteTenant = async () => {
    if (!targetTenant) return;
    setActionLoading(true);

    try {
      const response = await fetch(`/api/superadmin/tenants?id=${targetTenant.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(`Inquilino ${targetTenant.name} eliminado.`);
        setIsDeleteOpen(false);
        await loadTenants();
      } else {
        const err = await response.json();
        toast.error(err.error || "Error al eliminar");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error de red al eliminar");
    } finally {
      setActionLoading(false);
    }
  };

  // Filter Tenants
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.domain && t.domain.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && t.status === statusFilter;
  });

  // Calculate metrics
  const totalTenantsCount = tenants.length;
  const activeTenantsCount = tenants.filter((t) => t.status === "active").length;
  const suspendedTenantsCount = tenants.filter((t) => t.status === "suspended").length;
  const totalServersMonitored = tenants.reduce((acc, t) => acc + t.serversCount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Cargando panel SaaS Operator...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background text-foreground pb-12">
      
      {/* ─── Top Navbar ─── */}
      <header className="sticky top-0 z-40 border-b border-border/40 backdrop-blur-md bg-background/60">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-primary/20 to-indigo-500/10 border border-primary/20">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground/80 bg-clip-text text-transparent">
                ECA Soluciones - SaaS Operator
              </h1>
              <p className="text-xs text-muted-foreground">Panel de Super Administrador</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push("/")} className="gap-2 border-border/60">
              <ArrowLeft className="w-4 h-4" />
              <span>Ir al Dashboard</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-xl">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 mt-8">
        
        {/* ─── Stats Cards ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card/50 backdrop-blur-md border-border/40 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Inquilinos</CardTitle>
              <Building2 className="w-5 h-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold">{totalTenantsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Cuentas SaaS registradas</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-md border-border/40 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Licencias Activas</CardTitle>
              <Check className="w-5 h-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-emerald-400">{activeTenantsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Empresas en servicio activo</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-md border-border/40 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-all duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clientes Suspendidos</CardTitle>
              <Power className="w-5 h-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-red-400">{suspendedTenantsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Accesos revocados o suspendidos</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-md border-border/40 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Servidores Totales</CardTitle>
              <Server className="w-5 h-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-purple-400">{totalServersMonitored}</div>
              <p className="text-xs text-muted-foreground mt-1">Conectores de agentes RDP activos</p>
            </CardContent>
          </Card>
        </div>

        {/* ─── Main Content Grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          
          {/* ─── Left Side: Tenants List ─── */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar inquilino por nombre, ID o dominio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-card/40 border border-border/50 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="flex gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-card/40 border border-border/50 rounded-xl text-sm text-foreground focus:outline-none"
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="suspended">Suspendidos</option>
                </select>

                <Button onClick={() => setIsCreateOpen(true)} className="gap-2 rounded-xl">
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Inquilino</span>
                </Button>
              </div>
            </div>

            {/* Tenants Table */}
            <Card className="bg-card/30 backdrop-blur-md border-border/40 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/40 bg-card/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <th className="px-6 py-4">Inquilino / Empresa</th>
                        <th className="px-6 py-4">Servidores / Límite</th>
                        <th className="px-6 py-4">Plan / Expiración</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 text-sm">
                      {filteredTenants.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                            No se encontraron inquilinos cargados.
                          </td>
                        </tr>
                      ) : (
                        filteredTenants.map((t) => (
                          <tr key={t.id} className="hover:bg-card/30 transition-colors">
                            <td className="px-6 py-4">
                              <div>
                                <span className="font-semibold text-foreground">{t.name}</span>
                                <span className="text-xs text-muted-foreground block font-mono">ID: {t.id}</span>
                                {t.domain && (
                                  <span className="text-xs text-indigo-400 font-medium block">Dominio: {t.domain}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-medium">{t.serversCount} de {t.max_servers}</span>
                                <span className="text-xs text-muted-foreground">Servidores monitoreados</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 uppercase">
                                  {t.plan}
                                </span>
                                <span className="text-xs text-muted-foreground block mt-1">
                                  {t.expires_at ? new Date(t.expires_at).toLocaleDateString() : "Sin fecha límite"}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                t.status === "active" 
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                  : "bg-red-500/10 text-red-400 border border-red-500/20"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${t.status === "active" ? "bg-emerald-400" : "bg-red-400"}`} />
                                {t.status === "active" ? "Activo" : "Suspendido"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => toggleTenantStatus(t)}
                                  title={t.status === "active" ? "Suspender acceso" : "Activar acceso"}
                                  className={t.status === "active" ? "text-amber-400 hover:text-amber-300 hover:bg-amber-950/20" : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20"}
                                >
                                  <Power className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => openEditModal(t)}
                                  title="Editar configuración"
                                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-950/20"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => openDeleteModal(t)}
                                  title="Eliminar inquilino"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── Right Side: Create Tenant Panel / Quick actions ─── */}
          <div className="flex flex-col gap-6">
            
            {/* Quick Create Card */}
            <Card className="bg-card/50 backdrop-blur-md border-border/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Creación Rápida de Inquilino
                </CardTitle>
                <CardDescription>
                  Crea una nueva cuenta de cliente con su cuenta de administrador primaria.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateTenant} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Nombre de la Empresa</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Claro Telecom"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3.5 py-1.5 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">ID Slug (Automático)</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. claro-telecom"
                        value={newId}
                        onChange={(e) => setNewId(e.target.value)}
                        className="w-full px-3.5 py-1.5 bg-background border border-border/60 rounded-xl text-sm font-mono focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Plan</label>
                      <select
                        value={newPlan}
                        onChange={(e) => setNewPlan(e.target.value as Tenant['plan'])}
                        className="w-full px-3.5 py-1.5 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                      >
                        <option value="free">Free</option>
                        <option value="basic">Basic</option>
                        <option value="premium">Premium</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Límite Servidores</label>
                      <input
                        type="number"
                        min={1}
                        value={newMaxServers}
                        onChange={(e) => setNewMaxServers(parseInt(e.target.value, 10))}
                        className="w-full px-3.5 py-1.5 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Expiración (Opcional)</label>
                      <input
                        type="date"
                        value={newExpiresAt}
                        onChange={(e) => setNewExpiresAt(e.target.value)}
                        className="w-full px-3.5 py-1.5 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Dominio de Acceso (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej. claro.dashboard.site"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      className="w-full px-3.5 py-1.5 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                    />
                  </div>

                  <div className="border-t border-border/30 pt-4 mt-2">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Administrador del Cliente</h3>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold block mb-1">Nombre de Usuario</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. claro_admin"
                          value={newAdminUsername}
                          onChange={(e) => setNewAdminUsername(e.target.value)}
                          className="w-full px-3.5 py-1.5 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold block mb-1">Nombre Completo</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Juan Pérez"
                          value={newAdminFullName}
                          onChange={(e) => setNewAdminFullName(e.target.value)}
                          className="w-full px-3.5 py-1.5 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold block mb-1">Correo Electrónico (Para Onboarding)</label>
                        <input
                          type="email"
                          required
                          placeholder="admin@claro.com"
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                          className="w-full px-3.5 py-1.5 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                        />
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={actionLoading} className="w-full rounded-xl mt-2">
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Building2 className="w-4 h-4 mr-2" />
                    )}
                    Crear Inquilino
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Activation Link Details Panel */}
            {activationLink && (
              <Card className="bg-indigo-950/20 border-indigo-500/30 text-indigo-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4 text-indigo-400" />
                    Onboarding Generado
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-indigo-200/90 leading-relaxed">
                    Se encoló el correo SMTP de activación. En caso de fallas del correo, puedes copiar el token manual:
                  </p>
                  <div className="flex items-center gap-2 bg-muted/60 border border-indigo-500/20 p-2 rounded-xl text-xs font-mono select-all overflow-x-auto whitespace-nowrap">
                    <span>{activationLink}</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => copyToClipboard(activationLink)} 
                    className="w-full gap-2 border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-200"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copiar Enlace</span>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* ─── Edit Modal ─── */}
      {isEditOpen && targetTenant && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card border-border/80 shadow-xl">
            <CardHeader>
              <CardTitle>Editar Inquilino: {targetTenant.name}</CardTitle>
              <CardDescription>ID único: {targetTenant.id}</CardDescription>
            </CardHeader>
            <form onSubmit={handleUpdateTenant}>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">Nombre Comercial</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold block mb-1">Plan</label>
                    <select
                      value={editPlan}
                      onChange={(e) => setEditPlan(e.target.value as Tenant['plan'])}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none"
                    >
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Límite Servidores</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={editMaxServers}
                      onChange={(e) => setEditMaxServers(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold block mb-1">Expiración</label>
                    <input
                      type="date"
                      value={editExpiresAt}
                      onChange={(e) => setEditExpiresAt(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Estado</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as Tenant['status'])}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none"
                    >
                      <option value="active">Activo</option>
                      <option value="suspended">Suspendido</option>
                      <option value="expired">Expirado</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">Dominio</label>
                  <input
                    type="text"
                    value={editDomain}
                    onChange={(e) => setEditDomain(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none"
                  />
                </div>
              </CardContent>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/40">
                <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={actionLoading}>
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ─── Delete Confirm Modal ─── */}
      {isDeleteOpen && targetTenant && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card border-red-500/20 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500" />
            <CardHeader className="flex flex-row items-start gap-4">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-red-400">¿Eliminar Inquilino?</CardTitle>
                <CardDescription className="mt-1">
                  Estás a punto de eliminar permanentemente a <span className="font-semibold text-foreground">{targetTenant.name}</span>.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Esta acción es **irreversible**. Se borrarán automáticamente todos los usuarios, servidores monitored, logs de auditoría, capturas de pantalla y configuraciones asociadas a este cliente (debido a cascadas a nivel base de datos).
              </p>
              <div className="bg-muted/40 p-3 rounded-xl border border-border/40 text-xs font-mono text-center">
                Escribe <span className="font-bold text-foreground">{targetTenant.id}</span> para confirmar.
              </div>
              <input
                type="text"
                placeholder="Ingresa el ID del inquilino"
                onChange={(e) => {
                  if (e.target.value === targetTenant.id) {
                    // Enable delete button (we can just check value in button disabled prop)
                  }
                }}
                id="deleteConfirmInput"
                className="w-full px-3.5 py-1.5 bg-background border border-border/80 rounded-xl text-sm font-mono text-center focus:outline-none"
              />
            </CardContent>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/40 bg-muted/20">
              <Button type="button" variant="ghost" onClick={() => setIsDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="button" 
                variant="destructive"
                disabled={actionLoading}
                onClick={() => {
                  const input = document.getElementById("deleteConfirmInput") as HTMLInputElement;
                  if (input && input.value === targetTenant.id) {
                    handleDeleteTenant();
                  } else {
                    toast.error("El identificador ingresado no coincide.");
                  }
                }}
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Confirmar Eliminación
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
