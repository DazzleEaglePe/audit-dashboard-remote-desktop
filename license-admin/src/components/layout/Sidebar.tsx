import { NavLink } from 'react-router-dom';
import { KeyRound, ShieldCheck, Settings, BarChart3, LogOut } from 'lucide-react';
import { setToken } from '../../lib/api';

export default function Sidebar() {
  const handleLogout = () => {
    if (window.confirm('¿Desea cerrar la sesión de administración?')) {
      setToken('');
      window.location.reload();
    }
  };

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col min-h-screen text-xs">

      {/* Brand logo */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border gap-2.5">
        <ShieldCheck className="w-5.5 h-5.5 text-primary" />
        <div>
          <span className="font-bold text-sidebar-foreground text-sm tracking-tight block">ECA Soluciones</span>
          <span className="text-[10px] text-muted-foreground font-medium block">Licenciamiento v1.0</span>
        </div>
      </div>

      {/* Navigation menu */}
      <nav className="flex-1 py-6 px-3 space-y-1">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${
              isActive
                ? 'bg-primary/10 text-primary border border-primary/10'
                : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent border border-transparent'
            }`
          }
        >
          <KeyRound className="w-4.5 h-4.5" />
          <span>Claves de Activación</span>
        </NavLink>

        {/* Placeholder analytics item */}
        <div className="flex items-center gap-3 px-3 py-2 text-muted-foreground/60 cursor-not-allowed select-none">
          <BarChart3 className="w-4.5 h-4.5" />
          <span>Analíticas (Próximamente)</span>
        </div>

        {/* Placeholder settings item */}
        <div className="flex items-center gap-3 px-3 py-2 text-muted-foreground/60 cursor-not-allowed select-none">
          <Settings className="w-4.5 h-4.5" />
          <span>Configuración</span>
        </div>
      </nav>

      {/* Footer / logout */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors font-medium border border-transparent"
        >
          <LogOut className="w-4.5 h-4.5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>

    </aside>
  );
}
