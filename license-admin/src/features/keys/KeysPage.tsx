import { useRef } from 'react';
import { useKeys } from './hooks';
import KeysTable from './KeysTable';
import CreateKeyDialog from './CreateKeyDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export default function KeysPage() {
  const { data: keys, isLoading, isError, error, refetch, isRefetching } = useKeys();
  const containerRef = useRef<HTMLDivElement>(null);

  // GSAP animation for table rows on load
  useGSAP(() => {
    if (keys && keys.length > 0) {
      gsap.from('.key-row', {
        opacity: 0,
        y: 12,
        stagger: 0.03,
        duration: 0.45,
        ease: 'power2.out',
      });
    }
  }, { scope: containerRef, dependencies: [keys] });

  return (
    <div ref={containerRef} className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <KeyRound className="w-5.5 h-5.5 text-primary" />
            Claves de Activación
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Crea, lista, revoca o reemite licencias para los clientes on-premise.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="h-9 px-3 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <CreateKeyDialog />
        </div>
      </div>

      {/* Main card wrapper */}
      <Card className="border-border bg-card/40 backdrop-blur-md overflow-hidden">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-sm font-semibold text-foreground">Panel de Control de Claves</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Control centralizado de activaciones y hardware bindeado.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 pt-6 sm:pt-6">

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Cargando claves de activación...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <AlertCircle className="w-9 h-9 text-red-500 mb-3" />
              <h3 className="text-sm font-semibold text-foreground">Error al cargar claves</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                {error instanceof Error ? error.message : 'No se pudo conectar con el servidor de licencias. Verifique que esté encendido y que el token de acceso sea válido.'}
              </p>
              <Button 
                onClick={() => refetch()} 
                className="mt-4 h-8 text-xs"
                variant="outline"
              >
                Reintentar Conexión
              </Button>
            </div>
          ) : (
            <KeysTable keys={keys || []} />
          )}

        </CardContent>
      </Card>
      
    </div>
  );
}
