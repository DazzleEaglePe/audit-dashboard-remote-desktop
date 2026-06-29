import type { ActivationKey } from './types';
import { useRevokeKey, useReissueKey } from './hooks';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ShieldAlert,
  RefreshCw,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  Download,
  FileJson
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface KeysTableProps {
  keys: ActivationKey[];
}

export default function KeysTable({ keys }: KeysTableProps) {
  const revokeMutation = useRevokeKey();
  const reissueMutation = useReissueKey();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal state: Revoke
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [revokeKeyTarget, setRevokeKeyTarget] = useState<string | null>(null);

  // Modal state: Reissue Prompt
  const [isReissueOpen, setIsReissueOpen] = useState(false);
  const [reissueKeyTarget, setReissueKeyTarget] = useState<string | null>(null);
  const [newInstallId, setNewInstallId] = useState('');

  // Modal state: Reissue Result
  const [reissuedLicense, setReissuedLicense] = useState<{ data: string; signature: string } | null>(null);
  const [copiedLicense, setCopiedLicense] = useState(false);

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success('Clave copiada al portapapeles');
  };

  const handleRevokeClick = (key: string) => {
    setRevokeKeyTarget(key);
    setIsRevokeOpen(true);
  };

  const confirmRevoke = async () => {
    if (!revokeKeyTarget) return;
    try {
      await revokeMutation.mutateAsync(revokeKeyTarget);
      setIsRevokeOpen(false);
      setRevokeKeyTarget(null);
    } catch {
      // Error handled by hook
    }
  };

  const handleReissueClick = (key: string) => {
    setReissueKeyTarget(key);
    setNewInstallId('');
    setIsReissueOpen(true);
  };

  const confirmReissue = async () => {
    if (!reissueKeyTarget || !newInstallId.trim()) {
      toast.error('Debe ingresar un Install-ID válido');
      return;
    }
    try {
      const result = await reissueMutation.mutateAsync({
        activationKey: reissueKeyTarget,
        newInstallId: newInstallId.trim(),
      });
      setReissuedLicense(result);
      setIsReissueOpen(false);
    } catch {
      // Error handled by hook
    }
  };

  const downloadLicense = (lic: { data: string; signature: string }) => {
    const blob = new Blob([JSON.stringify(lic, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `license-${reissueKeyTarget || 'reissued'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Archivo de licencia descargado');
  };

  const copyLicenseText = (lic: { data: string; signature: string }) => {
    navigator.clipboard.writeText(JSON.stringify(lic, null, 2));
    setCopiedLicense(true);
    setTimeout(() => setCopiedLicense(false), 2000);
    toast.success('JSON de licencia copiado al portapapeles');
  };

  const getStatusBadge = (status: ActivationKey['status']) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15 border-emerald-500/20 text-[10px] py-0">
            Activa
          </Badge>
        );
      case 'used':
        return (
          <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/15 border-blue-500/20 text-[10px] py-0">
            En Uso
          </Badge>
        );
      case 'revoked':
        return (
          <Badge variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/15 border-red-500/20 text-[10px] py-0">
            Revocada
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-xl bg-muted/20 text-center">
        <KeyRound className="w-8 h-8 text-muted-foreground/70 mb-2.5" />
        <h3 className="text-sm font-semibold text-foreground">No hay claves de activación</h3>
        <p className="text-xs text-muted-foreground mt-1">Genera tu primera clave comercial para comenzar.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card/30 overflow-hidden">
        <Table className="text-xs text-foreground">
          <TableHeader className="bg-muted/40 border-border">
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="w-[180px] text-muted-foreground font-semibold py-3">Clave</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Cliente</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Límite Servidores</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Plan</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Estado</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Activaciones</TableHead>
              <TableHead className="text-muted-foreground font-semibold max-w-[150px] truncate">Install-ID</TableHead>
              <TableHead className="text-right text-muted-foreground font-semibold pr-6">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((k) => (
              <TableRow
                key={k.id}
                className="key-row hover:bg-muted/30 border-border/60 transition-colors"
              >
                <TableCell className="font-mono font-medium py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground">{k.key}</span>
                    <button
                      onClick={() => handleCopy(k.key)}
                      className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                      title="Copiar Clave"
                    >
                      {copiedKey === k.key ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </TableCell>
                <TableCell className="font-medium text-foreground">{k.customer_name}</TableCell>
                <TableCell className="text-muted-foreground">{k.max_servers}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{k.plan}</TableCell>
                <TableCell>{getStatusBadge(k.status)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {k.activation_count} / {k.max_activations}
                </TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground truncate max-w-[150px]" title={k.used_by_install_id || ''}>
                  {k.used_by_install_id || '—'}
                </TableCell>
                <TableCell className="text-right pr-4 py-2">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReissueClick(k.key)}
                      disabled={k.status === 'revoked' || reissueMutation.isPending}
                      className="h-8 text-[11px] px-2.5 hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/20 text-muted-foreground"
                      title="Reemitir para nueva máquina"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Reemitir
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRevokeClick(k.key)}
                      disabled={k.status === 'revoked' || revokeMutation.isPending}
                      className="h-8 text-[11px] px-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 hover:border-red-500/30"
                      title="Revocar Clave"
                    >
                      <ShieldAlert className="w-3 h-3 mr-1" />
                      Revocar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* MODAL 1: Confirmar Revocación */}
      <Dialog open={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500 font-bold text-base">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Confirmar Revocación
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Estás seguro de que deseas revocar la clave de activación <span className="font-mono text-foreground font-semibold">{revokeKeyTarget}</span>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2.5 text-xs text-muted-foreground space-y-2">
            <div className="flex gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>Esta acción es irreversible. Invalidará inmediatamente todas las licencias emitidas bajo esta clave.</span>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRevokeOpen(false)}
              className="h-9 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmRevoke}
              className="h-9 text-xs font-semibold"
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending && <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />}
              Revocar Clave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Reemitir - Ingresar nuevo Install-ID */}
      <Dialog open={isReissueOpen} onOpenChange={setIsReissueOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500 font-bold text-base">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              Reemitir Licencia
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configura la clave <span className="font-mono text-foreground font-semibold">{reissueKeyTarget}</span> para una nueva máquina de destino.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="grid gap-2">
              <Label htmlFor="installId" className="text-foreground font-medium">Nuevo Install-ID</Label>
              <Input
                id="installId"
                placeholder="Pegue el UUID único de la instalación..."
                value={newInstallId}
                onChange={(e) => setNewInstallId(e.target.value)}
                className="h-9 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Al reemitir, la licencia previamente activa asociada a esta clave quedará automáticamente revocada.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReissueOpen(false)}
              className="h-9 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmReissue}
              className="h-9 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
              disabled={reissueMutation.isPending}
            >
              {reissueMutation.isPending && <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />}
              Confirmar Reemisión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Reissue Result - Mostrar Licencia para Copiar/Descargar */}
      <Dialog open={!!reissuedLicense} onOpenChange={(val) => { if (!val) setReissuedLicense(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-500 font-bold text-base">
              <FileJson className="w-5 h-5 text-emerald-500" />
              Licencia Generada
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              La licencia se firmó con éxito. Copie o descargue el siguiente JSON para entregárselo al cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {reissuedLicense && (
              <div className="relative">
                <pre className="p-3 bg-muted border border-border rounded-lg text-[10px] font-mono text-emerald-500/90 overflow-x-auto max-h-[220px]">
                  {JSON.stringify(reissuedLicense, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <DialogFooter className="mt-2 flex flex-col sm:flex-row gap-2">
            {reissuedLicense && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyLicenseText(reissuedLicense)}
                  className="h-9 text-xs w-full sm:w-auto"
                >
                  {copiedLicense ? (
                    <Check className="w-4 h-4 mr-1.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1.5" />
                  )}
                  {copiedLicense ? 'Copiado' : 'Copiar JSON'}
                </Button>
                <Button
                  type="button"
                  onClick={() => downloadLicense(reissuedLicense)}
                  className="h-9 text-xs font-semibold w-full sm:w-auto"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Descargar license.json
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
