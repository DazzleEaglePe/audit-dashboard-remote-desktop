"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { User, Lock, Upload, Camera, CheckCircle, AlertCircle, Loader2, Shield } from "lucide-react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { t } = useLanguage();
  
  // Form states
  const [fullName, setFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarData, setAvatarData] = useState(""); // Base64
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const formRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial profile data
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/auth/profile");
        if (res.ok) {
          const data = await res.json();
          setFullName(data.fullName || "");
          if (data.avatarUrl) {
            setAvatarPreview(data.avatarUrl);
          }
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  // GSAP animation
  useEffect(() => {
    if (!loading && formRef.current) {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(
        formRef.current,
        { opacity: 0, y: -12 },
        { opacity: 1, y: 0, duration: 0.6 }
      ).fromTo(
        formRef.current.querySelectorAll(".settings-card"),
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 },
        "-=0.4"
      );
    }
  }, [loading]);

  // Handle file selection and convert to Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (e.g. 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("La imagen es demasiado grande. El límite es de 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAvatarPreview(base64String);
      setAvatarData(base64String);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Por favor, sube únicamente archivos de imagen.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("La imagen es demasiado grande. El límite es de 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAvatarPreview(base64String);
      setAvatarData(base64String);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // Submit changes
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(null);
    setError(null);

    // Validate passwords if input is not empty
    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        setError("Las contraseñas no coinciden.");
        setSaving(false);
        return;
      }
      if (newPassword.length < 6) {
        setError("La nueva contraseña debe tener al menos 6 caracteres.");
        setSaving(false);
        return;
      }
    }

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          newPassword: newPassword || undefined,
          avatarData: avatarData || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(t("settings.successMsg") as string);
        setNewPassword("");
        setConfirmPassword("");
        if (data.avatarUrl) {
          setAvatarPreview(data.avatarUrl);
        }
        
        // Dispatch custom event to notify sidebar profile to re-fetch
        window.dispatchEvent(new Event("profile-updated"));
      } else {
        const errData = await response.json();
        setError(errData.error || (t("settings.errorMsg") as string));
      }
    } catch (err) {
      console.error(err);
      setError(t("settings.errorMsg") as string);
    } finally {
      setSaving(false);
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

  return (
    <div ref={formRef} className="space-y-6 max-w-4xl mx-auto" style={{ opacity: 0 }}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t("settings.title") as string}</h1>
        <p className="text-muted-foreground text-sm">
          {t("settings.subtitle") as string}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="settings-card glass border-border/20 rounded-2xl overflow-hidden shadow-xl shadow-primary/2 duration-300">
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
            {/* Avatar Section */}
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

              {/* Upload Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 w-full border border-dashed border-border/30 hover:border-primary/40 bg-primary/2 hover:bg-primary/5 transition-all duration-300 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer text-center group"
              >
                <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                <p className="text-xs font-semibold text-foreground/90 mb-1">
                  {t("settings.avatarUpload") as string}
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

            {/* Form Inputs */}
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {t("settings.fullName") as string}
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
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card className="settings-card glass border-border/20 rounded-2xl overflow-hidden shadow-xl shadow-primary/2 duration-300">
          <CardHeader className="border-b border-border/10 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <Lock className="w-4 h-4" />
              Seguridad
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {t("settings.emptyPassword") as string}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {t("settings.newPassword") as string}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm font-medium transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {t("settings.confirmPassword") as string}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 rounded-xl px-3.5 bg-background/50 border border-border/20 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm font-medium transition-all"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications and messages */}
        {success && (
          <div className="settings-card flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-semibold">
            <CheckCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="settings-card flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-semibold">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit button */}
        <div className="settings-card flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="rounded-xl px-6 h-10 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs gap-2 transition-all shadow-md shadow-primary/10 disabled:opacity-70"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Shield className="w-3.5 h-3.5" />
                {t("settings.saveChanges") as string}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
