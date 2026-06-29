"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  Check, 
  Key, 
  Upload, 
  Server, 
  ArrowRight,
  ExternalLink
} from "lucide-react";

export default function LicensePage() {
  const router = useRouter();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<{
    valid: boolean;
    installId: string;
    customerName?: string;
    maxServers?: number;
    plan?: string;
    expiresAt?: string;
    reason?: string;
    features?: string[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"online" | "offline">("online");
  const [activationKey, setActivationKey] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [offlineLicense, setOfflineLicense] = useState<{ data: string; signature: string } | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);

  // Fetch status on load
  async function fetchLicenseStatus() {
    try {
      const res = await fetch("/api/license/status");
      if (res.status === 401) {
        // Not authenticated, redirect to login
        router.push("/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setApiError("No se pudo obtener el estado de la licencia.");
      }
    } catch (err) {
      setApiError("Error de red al consultar el estado de la licencia.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLicenseStatus();
  }, []);

  // Copy Install-ID to clipboard
  const handleCopy = () => {
    if (!status?.installId) return;
    navigator.clipboard.writeText(status.installId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle Online Activation
  async function handleOnlineActivate(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    setApiSuccess(null);
    if (!activationKey.trim()) {
      setApiError("Por favor ingresa una clave de activación.");
      return;
    }

    setActivating(true);
    try {
      const res = await fetch("/api/license/activate-online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activationKey: activationKey.trim() }),
      });

      if (res.ok) {
        setApiSuccess("¡Licencia activada con éxito! Redirigiéndote al Dashboard...");
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setApiError(data.error || "Ocurrió un error al activar la licencia en línea.");
      }
    } catch (err) {
      setApiError("Error de conexión con el servidor de licencias.");
    } finally {
      setActivating(false);
    }
  }

  // Handle Offline File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setApiError(null);
    setApiSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.data || !json.signature) {
          setFileError("El archivo no tiene el formato de licencia válido (faltan datos o firma).");
          return;
        }
        setOfflineLicense({ data: json.data, signature: json.signature });
      } catch (err) {
        setFileError("El archivo seleccionado no es un JSON válido.");
      }
    };
    reader.readAsText(file);
  };

  // Handle Offline Activation Submit
  async function handleOfflineActivate() {
    if (!offlineLicense) {
      setFileError("Por favor carga un archivo de licencia válido primero.");
      return;
    }

    setActivating(true);
    setApiError(null);
    setApiSuccess(null);

    try {
      const res = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offlineLicense),
      });

      if (res.ok) {
        setApiSuccess("¡Licencia offline validada e instalada con éxito! Redirigiéndote...");
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setApiError(data.error || "Error al procesar la firma de licencia localmente.");
      }
    } catch (err) {
      setApiError("Error de conexión al activar la licencia.");
    } finally {
      setActivating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
          <Shield className="w-8 h-8 text-primary animate-pulse" />
          <div className="space-y-1 text-center">
            <h1 className="text-sm font-medium tracking-tight text-foreground/80">Verificando Licencia...</h1>
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[11px]">Por favor espera</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reason mapping for beautiful display
  const getReasonMessage = (reason?: string) => {
    switch (reason) {
      case "missing":
        return "El servidor no cuenta con una licencia activa registrada.";
      case "invalid_signature":
        return "La firma de la licencia registrada no coincide o ha sido alterada.";
      case "install_mismatch":
        return "La licencia instalada no corresponde con el Install-ID de esta máquina.";
      case "expired":
        return "La licencia de uso para esta instalación ha expirado.";
      case "clock_tamper":
        return "Manipulación de reloj detectada. El reloj del sistema operativo se encuentra desincronizado.";
      default:
        return "Licencia no válida o pendiente de activación.";
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 md:p-8 animate-in fade-in duration-300">
      <div className="w-full max-w-lg space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-2 rounded-xl bg-primary/10 border border-primary/20 mb-2">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Activación de Licencia</h1>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Panel de control RDP - ECA Soluciones Empresariales
          </p>
        </div>

        {/* License status card */}
        <Card className="border border-border/40 shadow-sm bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Estado del Servidor</CardTitle>
              {status?.valid ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Activo
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive/80 border border-destructive/20 animate-pulse">
                  Requiere Activación
                </span>
              )}
            </div>
            {!status?.valid && (
              <CardDescription className="text-xs text-destructive/80 mt-1 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{getReasonMessage(status?.reason)}</span>
              </CardDescription>
            )}
          </CardHeader>
          
          <CardContent className="space-y-4 pt-0">
            {/* Install-ID clipboard widget */}
            <div className="rounded-lg bg-accent/20 border border-border/40 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  Identificador de Instalación (Install-ID)
                </Label>
                <button 
                  onClick={handleCopy}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-accent/40"
                  title="Copiar ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="font-mono text-xs select-all break-all pr-8 text-foreground/90">
                {status?.installId}
              </div>
              <p className="text-[10px] text-muted-foreground/60 leading-normal">
                Proporciona este código al administrador de licencias para generar un archivo de licencia offline válido para esta máquina.
              </p>
            </div>

            {/* If license is active, show info details */}
            {status?.valid && (
              <div className="border border-border/30 rounded-lg p-3.5 space-y-2.5 text-xs bg-emerald-500/5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-3">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Cliente</span>
                    <span className="font-medium text-foreground">{status.customerName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Plan</span>
                    <span className="font-medium text-foreground capitalize">{status.plan}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Máximo de Agentes</span>
                    <span className="font-medium text-foreground flex items-center gap-1">
                      <Server className="w-3 h-3 text-muted-foreground" />
                      {status.maxServers}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Vencimiento</span>
                    <span className="font-medium text-foreground">
                      {status.expiresAt ? new Date(status.expiresAt).toLocaleDateString() : "Indefinido"}
                    </span>
                  </div>
                </div>
                {status.features && status.features.length > 0 && (
                  <div className="pt-1.5 border-t border-border/30">
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider mb-1">Características Habilitadas</span>
                    <div className="flex flex-wrap gap-1.5">
                      {status.features.map(feat => (
                        <span key={feat} className="px-1.5 py-0.5 rounded bg-accent/40 border border-border/40 font-mono text-[9px]">
                          {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Button 
                    onClick={() => router.push("/")} 
                    className="w-full h-8 text-xs font-semibold"
                    variant="outline"
                  >
                    Ir al Dashboard
                    <ArrowRight className="w-3 h-3 ml-1.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activation flow section (Online/Offline) */}
        <Card className="border border-border/40 shadow-sm bg-card/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Método de Activación</CardTitle>
            <CardDescription className="text-xs">Selecciona la forma de activar tu instancia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Tab Selector */}
            <div className="flex rounded-lg bg-accent/20 p-1 border border-border/20">
              <button
                type="button"
                onClick={() => { setActiveTab("online"); setApiError(null); }}
                className={`flex-1 text-center py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "online" 
                    ? "bg-card text-foreground shadow-sm border border-border/10" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Activación en Línea
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("offline"); setApiError(null); }}
                className={`flex-1 text-center py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "offline" 
                    ? "bg-card text-foreground shadow-sm border border-border/10" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Activación Fuera de Línea
              </button>
            </div>

            {/* TAB 1: Online activation */}
            {activeTab === "online" && (
              <form onSubmit={handleOnlineActivate} className="space-y-3.5 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <Label htmlFor="activationKey" className="text-xs">Clave de Activación Comercial</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      id="activationKey"
                      type="text"
                      placeholder="ECA-XXXXX-XXXXX-XXXXX-XXXXX"
                      value={activationKey}
                      onChange={(e) => setActivationKey(e.target.value)}
                      className="pl-9 h-9 text-xs font-mono tracking-wider border-border/40 focus-visible:ring-primary/20"
                      disabled={activating}
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-9 text-xs" 
                  disabled={activating}
                >
                  {activating ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Shield className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {activating ? "Activando en línea..." : "Activar Instancia en Línea"}
                </Button>
              </form>
            )}

            {/* TAB 2: Offline activation */}
            {activeTab === "offline" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <Label className="text-xs">Cargar archivo de licencia (license.json)</Label>
                  
                  <div className="flex items-center justify-center w-full">
                    <label 
                      className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                        offlineLicense 
                          ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10" 
                          : "border-border/40 hover:bg-accent/10"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center pt-4 pb-4 px-4 text-center">
                        <Upload className={`w-6 h-6 mb-2 ${offlineLicense ? "text-emerald-400 animate-bounce" : "text-muted-foreground/60"}`} />
                        {offlineLicense ? (
                          <>
                            <p className="text-xs font-semibold text-emerald-400">¡Licencia cargada con éxito!</p>
                            <p className="text-[10px] text-muted-foreground/80 mt-0.5">Listo para validar y activar</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-foreground/80 font-medium">Haga clic o arrastre el archivo aquí</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">Cargar el archivo license.json provisto</p>
                          </>
                        )}
                      </div>
                      <input 
                        type="file" 
                        accept=".json"
                        className="hidden" 
                        onChange={handleFileUpload}
                        disabled={activating}
                      />
                    </label>
                  </div>
                  {fileError && <p className="text-[10px] text-destructive font-medium">{fileError}</p>}
                </div>

                <Button
                  onClick={handleOfflineActivate}
                  className="w-full h-9 text-xs"
                  disabled={activating || !offlineLicense}
                  variant={offlineLicense ? "default" : "secondary"}
                >
                  {activating ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {activating ? "Validando licencia..." : "Aplicar Licencia Fuera de Línea"}
                </Button>
              </div>
            )}

            {/* Error/Success Feedbacks */}
            {apiError && (
              <div className="flex gap-2 items-start p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive/90">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive/80" />
                <div>
                  <h4 className="font-semibold text-destructive">Error de Activación</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{apiError}</p>
                </div>
              </div>
            )}

            {apiSuccess && (
              <div className="flex gap-2 items-start p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                <div>
                  <h4 className="font-semibold text-emerald-400">Activación Completa</h4>
                  <p className="text-[10px] text-emerald-300/80 mt-0.5">{apiSuccess}</p>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="text-center space-y-1 text-muted-foreground/30 text-[10px]">
          <p>&copy; {new Date().getFullYear()} ECA Soluciones Empresariales SAC.</p>
          <p>Todos los derechos reservados.</p>
        </div>

      </div>
    </div>
  );
}
