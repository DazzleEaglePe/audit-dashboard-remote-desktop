import { useState, useEffect } from 'react';
import { getToken, setToken, validateToken } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Shield, Key, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TokenGateProps {
  children: React.ReactNode;
}

export default function TokenGate({ children }: TokenGateProps) {
  const [tokenInput, setTokenInput] = useState('');
  const [isValidating, setIsValidating] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Validate existing token on mount
  useEffect(() => {
    async function validateExisting() {
      const activeToken = getToken();
      if (!activeToken) {
        setIsValidating(false);
        return;
      }

      const isValid = await validateToken(activeToken);
      if (isValid) {
        setIsAuthenticated(true);
      } else {
        setToken(''); // Clean corrupt token
      }
      setIsValidating(false);
    }
    validateExisting();
  }, []);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanedToken = tokenInput.trim();

    if (!cleanedToken) {
      setErrorMsg('Por favor ingrese el token de administración');
      return;
    }

    setIsValidating(true);

    const isValid = await validateToken(cleanedToken);
    if (isValid) {
      setToken(cleanedToken);
      setIsAuthenticated(true);
      toast.success('Sesión iniciada con éxito');
    } else {
      setErrorMsg('El token ingresado no es válido o ha sido revocado');
      toast.error('Token inválido');
    }
    setIsValidating(false);
  };

  if (isValidating && !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
          <Shield className="w-8 h-8 text-primary animate-pulse" />
          <div className="space-y-1 text-center">
            <h1 className="text-sm font-medium text-foreground">Validando Credenciales...</h1>
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[10px]">Por favor espera</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-[380px] border-border bg-card/80 backdrop-blur-md text-card-foreground shadow-xl shadow-black/10">
          <CardHeader className="text-center space-y-2.5 pb-6">
            <div className="inline-flex items-center justify-center p-2 rounded-xl bg-primary/10 border border-primary/20 mx-auto">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">Administrador de Licencias</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                ECA Soluciones - Panel de Firma Centralizado
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleValidate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token" className="text-xs font-semibold text-foreground">ADMIN_API_TOKEN</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="token"
                    type="password"
                    placeholder="Pegue el token Bearer aquí..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="pl-9 h-9 text-xs focus-visible:ring-primary/20"
                    disabled={isValidating}
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="flex gap-2 items-start p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-500">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-9 text-xs font-semibold mt-2 shadow-sm"
                disabled={isValidating}
              >
                {isValidating ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Shield className="w-3.5 h-3.5 mr-1.5" />
                )}
                {isValidating ? 'Validando...' : 'Iniciar Sesión'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
