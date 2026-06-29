"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { User, Lock, Upload, Camera, CheckCircle, AlertCircle, Loader2, Shield, Mail, Bell, Settings, Terminal, Key, Trash2, Plus, Copy, Check, Download } from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";


export default function SettingsPage() {
  const { t } = useLanguage();
  const [forceChange, setForceChange] = useState(false);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setForceChange(params.get("forceChange") === "true");
    }
  }, []);
  
  // ─── UI & Loading States ───
  const [loading, setLoading] = useState(true);
  const formRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Profile Form States ───
  const [fullName, setFullName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarData, setAvatarData] = useState(""); // Base64
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // ─── Security Form States ───
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  // ─── Integrations Form States ───
  const [alertEmails, setAlertEmails] = useState("");
  const [slackWebhook, setSlackWebhook] = useState("");
  const [teamsWebhook, setTeamsWebhook] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [savingIntegrations, setSavingIntegrations] = useState(false);
  const [integrationsSuccess, setIntegrationsSuccess] = useState<string | null>(null);
  const [integrationsError, setIntegrationsError] = useState<string | null>(null);

  // ─── API Keys States ───
  const [apiKeys, setApiKeys] = useState<{ id: number; name: string; expires_at: string | null; created_at: string; last_used_at: string | null }[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiresAt, setNewKeyExpiresAt] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [generatedRawKey, setGeneratedRawKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  // ─── Servers Name States ───
  const [serversList, setServersList] = useState<{ id: string; hostname: string; name: string | null }[]>([]);
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [savingServerId, setSavingServerId] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // ─── Enrollment Tokens States ───
  const [enrollmentTokens, setEnrollmentTokens] = useState<{ id: number; name: string; max_uses: number | null; used_count: number; expires_at: string | null; revoked: number; created_by: string | null; created_at: string }[]>([]);
  const [newEnrollmentName, setNewEnrollmentName] = useState("");
  const [newEnrollmentMaxUses, setNewEnrollmentMaxUses] = useState("");
  const [newEnrollmentExpiresAt, setNewEnrollmentExpiresAt] = useState("");
  const [savingEnrollment, setSavingEnrollment] = useState(false);
  const [generatedRawEnrollment, setGeneratedRawEnrollment] = useState<string | null>(null);
  const [enrollmentCopied, setEnrollmentCopied] = useState(false);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState<string | null>(null);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);

  // Load profile, integrations, api keys, servers and enrollment tokens
  useEffect(() => {
    async function loadData() {
      try {
        // 1. Fetch Profile
        const profileRes = await fetch("/api/auth/profile");
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setFullName(profileData.fullName || "");
          if (profileData.avatarUrl) {
            setAvatarPreview(profileData.avatarUrl);
          }
        }

        // Only fetch integrations, keys, servers and enrollment tokens if we are not forcing a password change
        if (!forceChange) {
          // 2. Fetch Integrations Settings
          const settingsRes = await fetch("/api/settings/integrations");
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            setAlertEmails(settingsData.alert_emails || "");
            setSlackWebhook(settingsData.slack_webhook_url || "");
            setTeamsWebhook(settingsData.teams_webhook_url || "");
            setSmtpHost(settingsData.custom_smtp_host || "");
            setSmtpPort(settingsData.custom_smtp_port || 587);
            setSmtpUser(settingsData.custom_smtp_user || "");
            setSmtpPass(settingsData.custom_smtp_pass || "");
            setSmtpFrom(settingsData.custom_smtp_from || "");
          }

          // 3. Fetch API Keys
          const keysRes = await fetch("/api/settings/keys");
          if (keysRes.ok) {
            const keysData = await keysRes.json();
            setApiKeys(keysData);
          }

          // 4. Fetch Servers List
          const serversRes = await fetch("/api/servers");
          if (serversRes.ok) {
            const serversData = await serversRes.json();
            setServersList(serversData);
            const initialEdits: Record<string, string> = {};
            serversData.forEach((s: any) => {
              initialEdits[s.id] = s.name || "";
            });
            setEditingNames(initialEdits);
          }

          // 5. Fetch Enrollment Tokens
          const enrollTokensRes = await fetch("/api/settings/enrollment-tokens");
          if (enrollTokensRes.ok) {
            const enrollTokensData = await enrollTokensRes.json();
            setEnrollmentTokens(enrollTokensData);
          }
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [forceChange]);

  const handleSaveServerName = async (serverId: string) => {
    setSavingServerId(serverId);
    setServerSuccess(null);
    setServerError(null);
    
    try {
      const newName = editingNames[serverId] || "";
      const res = await fetch("/api/servers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: serverId, name: newName }),
      });
      
      if (res.ok) {
        setServerSuccess(t("settings.serverSaved"));
        setServersList(prev => prev.map(s => s.id === serverId ? { ...s, name: newName || null } : s));
        setTimeout(() => setServerSuccess(null), 3000);
      } else {
        const err = await res.json();
        setServerError(err.error || t("settings.serverSaveError"));
        setTimeout(() => setServerError(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setServerError(t("settings.serverSaveError"));
      setTimeout(() => setServerError(null), 3000);
    } finally {
      setSavingServerId(null);
    }
  };

  // Create API Key
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKey(true);
    setGeneratedRawKey(null);

    try {
      const response = await fetch("/api/settings/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          expires_at: newKeyExpiresAt || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedRawKey(data.rawKey);
        setNewKeyName("");
        setNewKeyExpiresAt("");
        
        // Reload keys list
        const keysRes = await fetch("/api/settings/keys");
        if (keysRes.ok) {
          const keysData = await keysRes.json();
          setApiKeys(keysData);
        }
      } else {
        const err = await response.json();
        alert(err.error || "Error al crear la clave de API");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión");
    } finally {
      setSavingKey(false);
    }
  };

  // Delete/Revoke API Key
  const handleDeleteKey = async (id: number, name: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas revocar la clave de API "${name}"? Los agentes que la usen perderán el acceso.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/settings/keys?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setApiKeys(prev => prev.filter(k => k.id !== id));
      } else {
        const err = await response.json();
        alert(err.error || "Error al eliminar");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión");
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  // Create Enrollment Token
  const handleCreateEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEnrollment(true);
    setGeneratedRawEnrollment(null);
    setEnrollmentSuccess(null);
    setEnrollmentError(null);

    try {
      const response = await fetch("/api/settings/enrollment-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEnrollmentName,
          max_uses: newEnrollmentMaxUses || null,
          expires_at: newEnrollmentExpiresAt || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedRawEnrollment(data.rawToken);
        setNewEnrollmentName("");
        setNewEnrollmentMaxUses("");
        setNewEnrollmentExpiresAt("");
        setEnrollmentSuccess(t("settings.enrollmentTokenSaved"));
        
        // Reload enrollment tokens list
        const enrollTokensRes = await fetch("/api/settings/enrollment-tokens");
        if (enrollTokensRes.ok) {
          const enrollTokensData = await enrollTokensRes.json();
          setEnrollmentTokens(enrollTokensData);
        }
      } else {
        const err = await response.json();
        setEnrollmentError(err.error || t("settings.enrollmentTokenSaveError"));
      }
    } catch (err) {
      console.error(err);
      setEnrollmentError(t("settings.enrollmentTokenSaveError"));
    } finally {
      setSavingEnrollment(false);
    }
  };

  // Revoke Enrollment Token
  const handleRevokeEnrollment = async (id: number, name: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas revocar el token de enrolamiento "${name}"? No se podrán registrar nuevos agentes con este token.`)) {
      return;
    }

    setEnrollmentSuccess(null);
    setEnrollmentError(null);

    try {
      const response = await fetch(`/api/settings/enrollment-tokens?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setEnrollmentSuccess(t("settings.enrollmentTokenRevoked"));
        // Update local list revoked status
        setEnrollmentTokens(prev => prev.map(t => t.id === id ? { ...t, revoked: 1 } : t));
        setTimeout(() => setEnrollmentSuccess(null), 3000);
      } else {
        const err = await response.json();
        setEnrollmentError(err.error || t("settings.enrollmentTokenRevokeError"));
        setTimeout(() => setEnrollmentError(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setEnrollmentError(t("settings.enrollmentTokenRevokeError"));
      setTimeout(() => setEnrollmentError(null), 3000);
    }
  };

  const handleCopyEnrollment = (token: string) => {
    navigator.clipboard.writeText(token);
    setEnrollmentCopied(true);
    setTimeout(() => setEnrollmentCopied(false), 2000);
  };

  // GSAP animation
  useGSAP(() => {
    if (!loading) {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.fromTo(
          formRef.current,
          { opacity: 0, y: -12 },
          { opacity: 1, y: 0, duration: 0.6 }
        ).fromTo(
          ".settings-card",
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 },
          "-=0.4"
        );
      });
    }
  }, { dependencies: [loading], scope: formRef });

  // Handle avatar changes
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setProfileError("La imagen es demasiado grande. El límite es de 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAvatarPreview(base64String);
      setAvatarData(base64String);
      setProfileError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Por favor, sube únicamente archivos de imagen.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setProfileError("La imagen es demasiado grande. El límite es de 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAvatarPreview(base64String);
      setAvatarData(base64String);
      setProfileError(null);
    };
    reader.readAsDataURL(file);
  };

  // Submit Profile Changes
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(null);
    setProfileError(null);

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          avatarData: avatarData || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProfileSuccess(t("settings.successMsg") as string);
        if (data.avatarUrl) {
          setAvatarPreview(data.avatarUrl);
        }
        window.dispatchEvent(new Event("profile-updated"));
      } else {
        const errData = await response.json();
        setProfileError(errData.error || (t("settings.errorMsg") as string));
      }
    } catch (err) {
      console.error(err);
      setProfileError(t("settings.errorMsg") as string);
    } finally {
      setSavingProfile(false);
    }
  };

  // Submit Security Changes
  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSecurity(true);
    setSecuritySuccess(null);
    setSecurityError(null);

    if (newPassword !== confirmPassword) {
      setSecurityError("Las contraseñas no coinciden.");
      setSavingSecurity(false);
      return;
    }

    if (newPassword.length < 6) {
      setSecurityError("La nueva contraseña debe tener al menos 6 caracteres.");
      setSavingSecurity(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      if (response.ok) {
        setSecuritySuccess("Contraseña actualizada con éxito. Redirigiendo...");
        setNewPassword("");
        setConfirmPassword("");
        if (forceChange) {
          setTimeout(() => {
            window.location.href = "/";
          }, 1500);
        }
      } else {
        const errData = await response.json();
        setSecurityError(errData.error || "Ocurrió un error al actualizar la contraseña.");
      }
    } catch (err) {
      console.error(err);
      setSecurityError("Error de conexión al actualizar.");
    } finally {
      setSavingSecurity(false);
    }
  };

  // Submit Integrations Changes
  const handleIntegrationsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingIntegrations(true);
    setIntegrationsSuccess(null);
    setIntegrationsError(null);

    try {
      const response = await fetch("/api/settings/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_emails: alertEmails,
          slack_webhook_url: slackWebhook,
          teams_webhook_url: teamsWebhook,
          custom_smtp_host: smtpHost,
          custom_smtp_port: smtpPort,
          custom_smtp_user: smtpUser,
          custom_smtp_pass: smtpPass,
          custom_smtp_from: smtpFrom,
        }),
      });

      if (response.ok) {
        setIntegrationsSuccess("Integraciones y configuración de alertas guardadas con éxito.");
      } else {
        const errData = await response.json();
        setIntegrationsError(errData.error || "Ocurrió un error al guardar la configuración.");
      }
    } catch (err) {
      console.error(err);
      setIntegrationsError("Error de conexión al guardar.");
    } finally {
      setSavingIntegrations(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="h-12 bg-accent/35 rounded-2xl w-64 animate-pulse" />
        <Card className="glass border-border/20 p-6 space-y-6">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-accent/35 animate-pulse shrink-0" />
            <div className="space-y-2 w-full">
              <div className="h-4 bg-accent/35 rounded w-1/4 animate-pulse" />
              <div className="h-8 bg-accent/35 rounded w-1/2 animate-pulse" />
            </div>
          </div>
          <div className="space-y-4 pt-4">
            <div className="h-10 bg-accent/35 rounded-xl animate-pulse" />
            <div className="h-10 bg-accent/35 rounded-xl animate-pulse" />
          </div>
        </Card>
      </div>
    );
  }

  if (forceChange) {
    return (
      <div className="space-y-6 max-w-md mx-auto pb-12 pt-8 animate-pulse-once">
        <div className="flex flex-col gap-2 text-center mb-6">
          <h1 className="text-2xl font-bold text-primary flex items-center justify-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Cambio de Contraseña
          </h1>
          <p className="text-muted-foreground text-sm">
            Debes actualizar tu contraseña temporal por seguridad antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSecuritySubmit}>
          <Card className="glass border-border/20 rounded-2xl overflow-hidden shadow-xl">
            <CardHeader className="border-b border-border/10 pb-4 bg-accent/5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Nueva Contraseña
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm font-medium transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Confirmar Contraseña
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm font-medium transition-all"
                  />
                </div>
              </div>

              {securitySuccess && (
                <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-semibold">
                  <CheckCircle className="w-4.5 h-4.5 shrink-0" />
                  <span>{securitySuccess}</span>
                </div>
              )}

              {securityError && (
                <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                  <span>{securityError}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={savingSecurity}
                  className="w-full rounded-xl h-10 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs gap-2 transition-all shadow-md"
                >
                  {savingSecurity ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  Actualizar Contraseña
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    );
  }

  return (
    <div ref={formRef} className="space-y-6 max-w-4xl mx-auto pb-12" style={{ opacity: 0 }}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t("settings.title") as string}</h1>
        <p className="text-muted-foreground text-sm">
          Configura tus datos de acceso, seguridad y canales de notificaciones para auditoría.
        </p>
      </div>

      {/* 1. Profile Section */}
      <form onSubmit={handleProfileSubmit}>
        <Card className="settings-card glass border-border/20 rounded-2xl overflow-hidden shadow-xl duration-300">
          <CardHeader className="border-b border-border/10 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <User className="w-4 h-4" />
              Información de Administrador
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Actualiza tu nombre y foto de perfil para la barra lateral.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group shrink-0">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/20 bg-background/50 flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-105">
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPreview}
                      alt="Avatar Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-muted-foreground/60" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full shadow-md hover:bg-primary/95 transition-all duration-300 transform scale-90 hover:scale-100"
                  title="Cambiar foto de perfil"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 w-full border border-dashed border-border/30 hover:border-primary/40 bg-primary/2 hover:bg-primary/5 transition-all duration-300 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer text-center group"
              >
                <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                <p className="text-xs font-semibold text-foreground/90 mb-1">
                  Sube una foto de perfil
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Arrastra y suelta aquí, o haz clic para explorar. PNG o JPG, máx 2MB.
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/jpg"
                  className="hidden"
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Administrador Principal"
                  required
                  className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm font-medium transition-all"
                />
              </div>
            </div>

            {profileSuccess && (
              <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-semibold">
                <CheckCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={savingProfile}
                className="rounded-xl px-6 h-10 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs gap-2 transition-all shadow-md"
              >
                {savingProfile ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Shield className="w-3.5 h-3.5" />
                )}
                Guardar Información
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* 2. Security Section */}
      <form onSubmit={handleSecuritySubmit}>
        <Card className="settings-card glass border-border/20 rounded-2xl overflow-hidden shadow-xl duration-300">
          <CardHeader className="border-b border-border/10 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <Lock className="w-4 h-4" />
              Seguridad y Contraseña
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Cambia tu contraseña periódicamente para mantener tu cuenta segura.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm font-medium transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Confirmar Contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm font-medium transition-all"
                />
              </div>
            </div>

            {securitySuccess && (
              <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-semibold">
                <CheckCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{securitySuccess}</span>
              </div>
            )}

            {securityError && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{securityError}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={savingSecurity}
                className="rounded-xl px-6 h-10 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs gap-2 transition-all shadow-md"
              >
                {savingSecurity ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                Actualizar Contraseña
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* 3. Notifications & Integrations Section */}
      <form onSubmit={handleIntegrationsSubmit}>
        <Card className="settings-card glass border-border/20 rounded-2xl overflow-hidden shadow-xl duration-300">
          <CardHeader className="border-b border-border/10 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <Bell className="w-4 h-4" />
              Notificaciones y Canales de Alerta
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Configura correos de destino e integraciones para notificaciones críticas de servidores.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {/* Alert Emails */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Mail className="w-3.5 h-3.5" /> Correos Receptores de Alertas (CSV)
              </label>
              <input
                type="text"
                value={alertEmails}
                onChange={(e) => setAlertEmails(e.target.value)}
                placeholder="auditoria@miempresa.com, seguridad@miempresa.com"
                className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm font-medium transition-all"
              />
              <p className="text-[10px] text-muted-foreground">
                Direcciones de correo electrónico separadas por comas que recibirán avisos cuando ocurran incidentes graves.
              </p>
            </div>

            {/* Slack Webhook */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Settings className="w-3.5 h-3.5" /> Webhook de Slack
              </label>
              <input
                type="text"
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
                className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm font-medium transition-all"
              />
            </div>

            {/* Teams Webhook */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Terminal className="w-3.5 h-3.5" /> Webhook de Microsoft Teams
              </label>
              <input
                type="text"
                value={teamsWebhook}
                onChange={(e) => setTeamsWebhook(e.target.value)}
                placeholder="https://suempresa.webhook.office.com/webhookb2/..."
                className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm font-medium transition-all"
              />
            </div>

            <hr className="border-border/10 my-4" />

            {/* Custom SMTP Header */}
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-foreground">SMTP Dedicado (Opcional)</h4>
              <p className="text-[10px] text-muted-foreground">
                Configura un servidor de correo propio para que tus notificaciones se envíen desde tu correo corporativo. Dejar en blanco para usar el servidor global.
              </p>
            </div>

            {/* SMTP Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Servidor de Salida (Host)</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Puerto</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(parseInt(e.target.value, 10) || 587)}
                  placeholder="587"
                  className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Usuario SMTP</label>
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="alertas@miempresa.com"
                  className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Contraseña SMTP</label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Remitente (From)</label>
                <input
                  type="text"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  placeholder="Auditoría ECA <alertas@miempresa.com>"
                  className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none text-sm"
                />
              </div>
            </div>

            {integrationsSuccess && (
              <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-semibold">
                <CheckCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{integrationsSuccess}</span>
              </div>
            )}

            {integrationsError && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{integrationsError}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={savingIntegrations}
                className="rounded-xl px-6 h-10 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs gap-2 transition-all shadow-md"
              >
                {savingIntegrations ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Bell className="w-3.5 h-3.5" />
                )}
                Guardar Integraciones
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* 4. API Keys Management Section */}
      <Card className="settings-card glass border-border/20 rounded-2xl overflow-hidden shadow-xl duration-300">
        <CardHeader className="border-b border-border/10 pb-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
            <Key className="w-4 h-4" />
            Claves de API de Agentes
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Genera y administra claves de instalación seguras para tus agentes de Windows (ECA Monitor).
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          
          {/* Generated Raw Key Banner */}
          {generatedRawKey && (
            <div className="bg-indigo-950/20 border border-indigo-500/30 text-indigo-100 p-4 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                <AlertCircle className="w-4 h-4" />
                <span>CLAVE GENERADA CON ÉXITO</span>
              </div>
              <p className="text-[11px] text-indigo-200/90 leading-relaxed">
                Copia esta clave de API ahora. **No podrás volver a verla en el futuro** debido a que se almacena de forma cifrada mediante hash SHA-256.
              </p>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  readOnly
                  value={generatedRawKey}
                  className="flex-1 h-9 px-3 bg-background/80 border border-indigo-500/20 rounded-lg text-xs font-mono select-all focus:outline-none"
                />
                <Button 
                  size="sm" 
                  onClick={() => handleCopyKey(generatedRawKey)}
                  className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 gap-1.5"
                >
                  {keyCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{keyCopied ? "Copiado" : "Copiar"}</span>
                </Button>
              </div>
            </div>
          )}

          {/* Quick Create API Key Subform */}
          <form onSubmit={handleCreateKey} className="space-y-4 bg-background/20 p-4 rounded-xl border border-border/10">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-primary" /> Generar Nueva Clave
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Nombre de la Clave</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Servidor de Producción 1"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none text-sm font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Fecha de Expiración (Opcional)</label>
                <input
                  type="date"
                  value={newKeyExpiresAt}
                  onChange={(e) => setNewKeyExpiresAt(e.target.value)}
                  className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none text-sm font-medium"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={savingKey}
                className="rounded-xl px-5 h-9 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs gap-2 transition-all shadow-md"
              >
                {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Generar Clave
              </Button>
            </div>
          </form>

          {/* Active Keys List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-foreground">Claves de API Activas</h4>
            
            {apiKeys.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground bg-background/5 rounded-xl border border-border/10">
                No hay claves de API creadas. Los agentes nuevos no podrán autenticarse.
              </div>
            ) : (
              <div className="overflow-hidden border border-border/10 rounded-xl bg-background/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/10 bg-background/25 text-muted-foreground font-semibold">
                        <th className="px-4 py-2.5">Nombre</th>
                        <th className="px-4 py-2.5">Creada</th>
                        <th className="px-4 py-2.5">Último Uso</th>
                        <th className="px-4 py-2.5">Expiración</th>
                        <th className="px-4 py-2.5 text-right">Revocar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10">
                      {apiKeys.map((k) => (
                        <tr key={k.id} className="hover:bg-background/10 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{k.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(k.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Nunca"}
                          </td>
                          <td className="px-4 py-3">
                            {k.expires_at ? (
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] ${
                                new Date() > new Date(k.expires_at) 
                                  ? "bg-red-500/10 text-red-400" 
                                  : "bg-amber-500/10 text-amber-400"
                              }`}>
                                {new Date(k.expires_at).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60">Sin límite</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteKey(k.id, k.name)}
                              className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      {/* 4.5. Enrollment Tokens Management Section */}
      {!forceChange && (
        <Card className="settings-card glass border-border/20 rounded-2xl overflow-hidden shadow-xl duration-300 mt-6">
          <CardHeader className="border-b border-border/10 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <Terminal className="w-4 h-4" />
              {t("settings.enrollmentTitle")}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {t("settings.enrollmentSubtitle")}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            
            {/* Download Agent MSI block */}
            <div className="flex items-center justify-between p-4 bg-background/30 border border-border/10 rounded-xl">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-foreground">Instalador del Agente Windows (MSI)</h4>
                <p className="text-[11px] text-muted-foreground">Descarga el instalador MSI para despliegues masivos y silenciosos.</p>
              </div>
              <a 
                href="/api/agent/download" 
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar MSI
              </a>
            </div>

            {/* Generated Raw Enrollment Token Banner */}
            {generatedRawEnrollment && (
              <div className="bg-indigo-950/20 border border-indigo-500/30 text-indigo-100 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>TOKEN DE ENROLAMIENTO GENERADO</span>
                </div>
                <p className="text-[11px] text-indigo-200/90 leading-relaxed">
                  Copia este token ahora. **No podrás volver a verlo en el futuro** debido a que se almacena en base de datos cifrado mediante hash SHA-256.
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    readOnly
                    value={generatedRawEnrollment}
                    className="flex-1 h-9 px-3 bg-background/80 border border-indigo-500/20 rounded-lg text-xs font-mono select-all focus:outline-none"
                  />
                  <Button 
                    size="sm" 
                    onClick={() => handleCopyEnrollment(generatedRawEnrollment)}
                    className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 gap-1.5"
                  >
                    {enrollmentCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{enrollmentCopied ? "Copiado" : "Copiar"}</span>
                  </Button>
                </div>
                
                <div className="space-y-1.5 pt-2 border-t border-indigo-500/20">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase">Comando de instalación (MSI)</span>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      readOnly
                      value={`msiexec /i EcaAgent.msi /qn ENROLL_TOKEN=${generatedRawEnrollment} API_URL=${typeof window !== 'undefined' ? window.location.origin : ''}/api`}
                      className="flex-1 h-9 px-3 bg-background/80 border border-indigo-500/20 rounded-lg text-xs font-mono select-all focus:outline-none"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => handleCopyEnrollment(`msiexec /i EcaAgent.msi /qn ENROLL_TOKEN=${generatedRawEnrollment} API_URL=${typeof window !== 'undefined' ? window.location.origin : ''}/api`)}
                      className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Comando</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Create Enrollment Token Subform */}
            <form onSubmit={handleCreateEnrollment} className="space-y-4 bg-background/20 p-4 rounded-xl border border-border/10">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-primary" /> {t("settings.enrollmentBtn")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("settings.enrollmentName")}</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Despliegue GPO 2026"
                    value={newEnrollmentName}
                    onChange={(e) => setNewEnrollmentName(e.target.value)}
                    className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none text-sm font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("settings.enrollmentMaxUses")}</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ej. 10 (Sin límite = vacío)"
                    value={newEnrollmentMaxUses}
                    onChange={(e) => setNewEnrollmentMaxUses(e.target.value)}
                    className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none text-sm font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("settings.enrollmentExpires")}</label>
                  <input
                    type="date"
                    value={newEnrollmentExpiresAt}
                    onChange={(e) => setNewEnrollmentExpiresAt(e.target.value)}
                    className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none text-sm font-medium"
                  />
                </div>
              </div>
              
              {enrollmentSuccess && (
                <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-xs font-semibold">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{enrollmentSuccess}</span>
                </div>
              )}

              {enrollmentError && (
                <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{enrollmentError}</span>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  disabled={savingEnrollment}
                  className="rounded-xl px-5 h-9 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs gap-2 transition-all shadow-md"
                >
                  {savingEnrollment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  {t("settings.enrollmentBtn")}
                </Button>
              </div>
            </form>

            {/* Active Enrollment Tokens List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground">{t("settings.enrollmentTitle")} Activos</h4>
              
              {enrollmentTokens.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground bg-background/5 rounded-xl border border-border/10">
                  {t("settings.enrollmentNoTokens")}
                </div>
              ) : (
                <div className="overflow-hidden border border-border/10 rounded-xl bg-background/5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border/10 bg-background/25 text-muted-foreground font-semibold">
                          <th className="px-4 py-2.5">Nombre</th>
                          <th className="px-4 py-2.5">Creado por</th>
                          <th className="px-4 py-2.5">Creado</th>
                          <th className="px-4 py-2.5">{t("settings.enrollmentUses")}</th>
                          <th className="px-4 py-2.5">{t("settings.enrollmentExpiresLabel")}</th>
                          <th className="px-4 py-2.5">{t("settings.enrollmentStatus")}</th>
                          <th className="px-4 py-2.5 text-right">{t("settings.enrollmentRevokeBtn")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/10">
                        {enrollmentTokens.map((tok) => (
                          <tr key={tok.id} className="hover:bg-background/10 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{tok.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{tok.created_by || "Sistema"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{new Date(tok.created_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-foreground font-semibold">
                              {tok.used_count} / {tok.max_uses !== null ? tok.max_uses : t("settings.enrollmentUnlimited")}
                            </td>
                            <td className="px-4 py-3">
                              {tok.expires_at ? (
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] ${
                                  new Date() > new Date(tok.expires_at) 
                                    ? "bg-red-500/10 text-red-400" 
                                    : "bg-amber-500/10 text-amber-400"
                                }`}>
                                  {new Date(tok.expires_at).toLocaleDateString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60">{t("settings.enrollmentUnlimited")}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {tok.revoked === 1 ? (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400">
                                  {t("settings.enrollmentTokenRevokedLabel")}
                                </span>
                              ) : tok.expires_at && new Date() > new Date(tok.expires_at) ? (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400">
                                  Expirado
                                </span>
                              ) : (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400">
                                  {t("settings.enrollmentTokenActive")}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={tok.revoked === 1}
                                onClick={() => handleRevokeEnrollment(tok.id, tok.name)}
                                className={`h-7 w-7 rounded-lg ${
                                  tok.revoked === 1 
                                    ? "text-muted-foreground/45 cursor-not-allowed" 
                                    : "text-red-400 hover:text-red-300 hover:bg-red-950/20"
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          </CardContent>
        </Card>
      )}

      {/* 5. Registered Servers Management Section */}
      {!forceChange && (
        <Card className="settings-card glass border-border/20 rounded-2xl overflow-hidden shadow-xl duration-300 mt-6">
          <CardHeader className="border-b border-border/10 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <Settings className="w-4 h-4" />
              {t("settings.serversTitle")}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {t("settings.serversSubtitle")}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {serverSuccess && (
              <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-semibold animate-fade-in">
                <CheckCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{serverSuccess}</span>
              </div>
            )}

            {serverError && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold animate-fade-in">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <div className="space-y-4">
              {serversList.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground bg-background/5 rounded-xl border border-border/10">
                  No hay servidores registrados en este tenant.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {serversList.map((s) => (
                    <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-background/10 border border-border/10 hover:border-border/30 transition-all duration-300">
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-bold text-foreground truncate">
                          {s.name || s.hostname}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                          ID: {s.id} | Host: {s.hostname}
                        </p>
                      </div>
                      
                      <div className="flex gap-2.5 items-center">
                        <input
                          type="text"
                          placeholder={t("settings.serverFriendlyName")}
                          value={editingNames[s.id] ?? ""}
                          onChange={(e) => setEditingNames(prev => ({ ...prev, [s.id]: e.target.value }))}
                          className="h-9 w-48 sm:w-60 rounded-lg px-3 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none text-xs font-medium"
                        />
                        <Button
                          size="sm"
                          disabled={savingServerId === s.id}
                          onClick={() => handleSaveServerName(s.id)}
                          className="h-9 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs gap-1.5 px-3 shadow"
                        >
                          {savingServerId === s.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{t("settings.saveName")}</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
