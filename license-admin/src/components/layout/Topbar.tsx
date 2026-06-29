import { ShieldCheck, Activity } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';

export default function Topbar() {
  return (
    <header className="h-16 border-b border-border bg-background/40 backdrop-blur-md flex items-center justify-between px-6 sm:px-8 text-xs">

      {/* Search / Context placeholder */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground font-medium">Panel de Operaciones</span>
      </div>

      {/* Connection & session status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
          <Activity className="w-3.5 h-3.5" />
          <span className="font-semibold text-[10px] tracking-wide uppercase">Servidor Activo</span>
        </div>

        <div className="h-4 w-px bg-border" />

        <ModeToggle />

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground">Administrador</span>
        </div>
      </div>

    </header>
  );
}
