"use client";

import { useState, useEffect } from "react";
import { 
  Users, Plus, Edit2, Trash2, Mail, Loader2, Shield, Eye, Check, AlertCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface User {
  id: number;
  tenantId: string;
  username: string;
  fullName: string;
  email: string;
  avatarUrl: string;
  role: 'admin' | 'viewer';
  createdAt: string;
  pending: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);

  // Modal States
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form States (Invite)
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState<'admin' | 'viewer'>("viewer");

  // Form States (Edit)
  const [editFullName, setEditFullName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState<'admin' | 'viewer'>("viewer");

  async function loadData() {
    try {
      // Load current user profile for guards
      const profileRes = await fetch("/api/auth/profile");
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setCurrentUser(profile);
      }

      // Load users
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        toast.error("No se pudo cargar la lista de usuarios.");
      }
    } catch {
      toast.error("Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteUsername || !inviteEmail || !inviteFullName) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: inviteUsername,
          email: inviteEmail,
          fullName: inviteFullName,
          role: inviteRole,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Invitación enviada con éxito.");
        setIsInviteOpen(false);
        // Clear form
        setInviteUsername("");
        setInviteEmail("");
        setInviteFullName("");
        setInviteRole("viewer");
        loadData();
      } else {
        toast.error(data.error || "Error al invitar usuario.");
      }
    } catch {
      toast.error("Error de red al invitar usuario.");
    } finally {
      setActionLoading(false);
    }
  }

  function openEditModal(user: User) {
    setTargetUser(user);
    setEditFullName(user.fullName);
    setEditUsername(user.username);
    setEditRole(user.role);
    setIsEditOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUser) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${targetUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editFullName,
          role: editRole,
          username: editUsername,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Usuario actualizado con éxito.");
        setIsEditOpen(false);
        loadData();
      } else {
        toast.error(data.error || "Error al actualizar usuario.");
      }
    } catch {
      toast.error("Error de red al actualizar usuario.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResendInvite(user: User) {
    try {
      const res = await fetch(`/api/users/${user.id}/resend-invite`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Enlace de invitación reenviado.");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al reenviar invitación.");
      }
    } catch {
      toast.error("Error de red al reenviar invitación.");
    }
  }

  function openDeleteModal(user: User) {
    setTargetUser(user);
    setIsDeleteOpen(true);
  }

  async function handleDelete() {
    if (!targetUser) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${targetUser.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Usuario eliminado correctamente.");
        setIsDeleteOpen(false);
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al eliminar usuario.");
      }
    } catch {
      toast.error("Error de red al eliminar usuario.");
    } finally {
      setActionLoading(false);
    }
  }

  const isLastAdmin = (user: User) => {
    if (user.role !== 'admin') return false;
    const admins = users.filter(u => u.role === 'admin');
    return admins.length <= 1;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Gestión de Equipo</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Administra los accesos y roles de los usuarios que colaboran en tu empresa.
          </p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)} className="rounded-xl text-xs gap-1.5 h-9">
          <Plus className="w-3.5 h-3.5" />
          Invitar Colaborador
        </Button>
      </div>

      <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Miembros Registrados ({users.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Users className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-xs text-muted-foreground">No hay usuarios registrados en este tenant.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/20 bg-muted/40 text-muted-foreground font-semibold">
                    <th className="px-6 py-3.5">Nombre</th>
                    <th className="px-6 py-3.5">Usuario / Correo</th>
                    <th className="px-6 py-3.5">Rol</th>
                    <th className="px-6 py-3.5">Estado</th>
                    <th className="px-6 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {users.map((u) => {
                    const self = currentUser?.username === u.username;
                    const lastAdmin = isLastAdmin(u);
                    
                    return (
                      <tr key={u.id} className="hover:bg-accent/20 transition-colors">
                        <td className="px-6 py-4 font-medium">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-[10px] text-primary">
                              {u.fullName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold block">{u.fullName}</span>
                              {self && (
                                <span className="inline-block mt-0.5 text-[9px] bg-primary/10 text-primary border border-primary/20 rounded-full px-1.5 font-bold">
                                  Tú
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="block font-mono text-muted-foreground text-[11px]">@{u.username}</span>
                          <span className="block text-muted-foreground/60 text-[10px] mt-0.5">{u.email}</span>
                        </td>
                        <td className="px-6 py-4">
                          {u.role === "admin" ? (
                            <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] gap-1 px-2 rounded-lg font-medium">
                              <Shield className="w-3 h-3" />
                              Administrador
                            </Badge>
                          ) : (
                            <Badge className="bg-muted text-muted-foreground border border-border/20 text-[10px] gap-1 px-2 rounded-lg font-medium">
                              <Eye className="w-3 h-3" />
                              Visualizador
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {u.pending ? (
                            <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/5 text-[9px] px-2 py-0.5 rounded-lg">
                              Pendiente
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/5 text-[9px] px-2 py-0.5 rounded-lg">
                              Activo
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.pending && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleResendInvite(u)}
                                title="Reenviar enlace de activación"
                                className="h-7 w-7 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditModal(u)}
                              title="Editar miembro"
                              className="h-7 w-7 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteModal(u)}
                              disabled={self || lastAdmin}
                              title={
                                self 
                                  ? "No puedes eliminarte a ti mismo" 
                                  : lastAdmin 
                                    ? "No puedes eliminar al único administrador" 
                                    : "Eliminar miembro"
                              }
                              className="h-7 w-7 text-red-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Modal Invitar Colaborador ─── */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Invitar Colaborador</DialogTitle>
            <DialogDescription className="text-xs">
              Introduce los datos para enviar el enlace de activación.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="inviteUsername" className="text-xs">Usuario (login único)</Label>
              <Input
                id="inviteUsername"
                type="text"
                placeholder="juan.perez"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inviteFullName" className="text-xs">Nombre Completo</Label>
              <Input
                id="inviteFullName"
                type="text"
                placeholder="Juan Pérez"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inviteEmail" className="text-xs">Correo Electrónico</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="juan@empresa.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rol de Acceso</Label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'viewer')}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none h-9"
              >
                <option value="viewer">Visualizador (solo lectura)</option>
                <option value="admin">Administrador (control total)</option>
              </select>
            </div>

            <DialogFooter className="mt-4 flex flex-row gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsInviteOpen(false)} className="text-xs">
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={actionLoading} className="text-xs">
                {actionLoading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                Enviar Invitación
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Modal Editar Miembro ─── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Editar Miembro</DialogTitle>
            <DialogDescription className="text-xs">
              Modifica los privilegios o detalles del usuario.
            </DialogDescription>
          </DialogHeader>
          {targetUser && (
            <form onSubmit={handleEdit} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="editUsername" className="text-xs">Nombre de Usuario</Label>
                <Input
                  id="editUsername"
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editFullName" className="text-xs">Nombre Completo</Label>
                <Input
                  id="editFullName"
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rol de Acceso</Label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'admin' | 'viewer')}
                  disabled={isLastAdmin(targetUser) && currentUser?.username === targetUser.username}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none h-9 disabled:opacity-50"
                >
                  <option value="viewer">Visualizador (solo lectura)</option>
                  <option value="admin">Administrador (control total)</option>
                </select>
                {isLastAdmin(targetUser) && currentUser?.username === targetUser.username && (
                  <p className="text-[10px] text-amber-500 font-semibold mt-1">
                    No puedes rebajar tu rol porque eres el único administrador.
                  </p>
                )}
              </div>

              <DialogFooter className="mt-4 flex flex-row gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditOpen(false)} className="text-xs">
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={actionLoading} className="text-xs">
                  {actionLoading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Modal Confirmar Eliminación ─── */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-[320px] rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
          <DialogHeader className="flex flex-col items-center text-center space-y-2 pb-2">
            <div className="p-2.5 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-sm font-bold">¿Eliminar Colaborador?</DialogTitle>
            <DialogDescription className="text-xs">
              Esta acción revocará de forma permanente el acceso de <span className="font-semibold text-foreground">@{targetUser?.username}</span> a la plataforma.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-row gap-2 justify-center">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsDeleteOpen(false)} className="text-xs flex-1">
              Cancelar
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={actionLoading} className="text-xs flex-1">
              {actionLoading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
