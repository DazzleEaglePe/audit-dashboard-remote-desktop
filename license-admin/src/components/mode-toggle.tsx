import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", icon: Sun, label: "Claro" },
  { value: "system", icon: Monitor, label: "Sistema" },
  { value: "dark", icon: Moon, label: "Oscuro" },
] as const;

export function ModeToggle() {
  const { theme = "system", setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Cambiar tema"
      className="flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-muted/40"
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-label={`Tema ${label}`}
          aria-pressed={theme === value}
          title={label}
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
            theme === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
