import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateKey } from './hooks';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';

const formSchema = z.object({
  customerName: z.string().min(2, { message: 'El nombre del cliente debe tener al menos 2 caracteres' }),
  maxServers: z.number().min(1, { message: 'Debe permitir al menos 1 servidor' }),
  plan: z.string(),
  features: z.string().optional(),
  expiresDays: z.number().min(1, { message: 'Los días deben ser mayores a 0' }),
  maxActivations: z.number().min(1, { message: 'Las activaciones deben ser al menos 1' }),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateKeyDialog() {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateKey();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: '',
      maxServers: 10,
      plan: 'standard',
      features: 'alerts,logs',
      expiresDays: 365,
      maxActivations: 1,
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createMutation.mutateAsync(values);
      reset();
      setOpen(false);
    } catch {
      // Handled by hook onError
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if(!val) reset(); }}>
      <DialogTrigger asChild>
        <Button className="h-9 text-xs font-semibold gap-1.5 shadow-sm">
          <Plus className="w-4 h-4" />
          Crear Clave
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Crear Clave de Activación</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Genera una nueva clave comercial. Toda licencia resultante estará atada al Install-ID del cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 text-xs">
            {/* Customer Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="customerName" className="text-foreground font-medium">Nombre del Cliente</Label>
              <Input
                id="customerName"
                placeholder="Empresa SAC..."
                className="h-9 focus:border-primary/50"
                {...register('customerName')}
              />
              {errors.customerName && (
                <span className="text-destructive text-[10px]">{errors.customerName.message}</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Max Servers */}
              <div className="grid gap-1.5">
                <Label htmlFor="maxServers" className="text-foreground font-medium">Máx. Servidores</Label>
                <Input
                  id="maxServers"
                  type="number"
                  className="h-9"
                  {...register('maxServers', { valueAsNumber: true })}
                />
                {errors.maxServers && (
                  <span className="text-destructive text-[10px]">{errors.maxServers.message}</span>
                )}
              </div>

              {/* Plan Selection */}
              <div className="grid gap-1.5">
                <Label htmlFor="plan" className="text-foreground font-medium">Plan</Label>
                <Select
                  defaultValue="standard"
                  onValueChange={(val) => setValue('plan', val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecciona plan" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Expires Days */}
              <div className="grid gap-1.5">
                <Label htmlFor="expiresDays" className="text-foreground font-medium">Vigencia (Días)</Label>
                <Input
                  id="expiresDays"
                  type="number"
                  className="h-9"
                  {...register('expiresDays', { valueAsNumber: true })}
                />
                {errors.expiresDays && (
                  <span className="text-destructive text-[10px]">{errors.expiresDays.message}</span>
                )}
              </div>

              {/* Max Activations */}
              <div className="grid gap-1.5">
                <Label htmlFor="maxActivations" className="text-foreground font-medium">Límite Activaciones</Label>
                <Input
                  id="maxActivations"
                  type="number"
                  className="h-9"
                  {...register('maxActivations', { valueAsNumber: true })}
                />
                {errors.maxActivations && (
                  <span className="text-destructive text-[10px]">{errors.maxActivations.message}</span>
                )}
              </div>
            </div>

            {/* Features (CSV list) */}
            <div className="grid gap-1.5">
              <Label htmlFor="features" className="text-foreground font-medium">Características (Separadas por comas)</Label>
              <Input
                id="features"
                placeholder="alerts,logs,screenshots,webhooks"
                className="h-9"
                {...register('features')}
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-9 text-xs"
              disabled={createMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="h-9 text-xs font-semibold"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              Generar Clave
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
