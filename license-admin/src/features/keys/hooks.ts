import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import type { ActivationKey, NewKey } from './types';
import { toast } from 'sonner';

export const useKeys = () => {
  return useQuery({
    queryKey: ['keys'],
    queryFn: () => apiFetch<ActivationKey[]>('/api/admin/keys'),
  });
};

export const useCreateKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewKey) => 
      apiFetch<ActivationKey>('/api/admin/keys', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['keys'] });
      toast.success(`Clave creada con éxito: ${data.key}`);
    },
    onError: (err: Error) => {
      toast.error(`Error al crear clave: ${err.message}`);
    },
  });
};

export const useRevokeKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (activationKey: string) =>
      apiFetch<{ success: boolean; message: string }>('/api/admin/revoke', {
        method: 'POST',
        body: JSON.stringify({ activationKey }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['keys'] });
      toast.success(data.message || 'Clave revocada correctamente');
    },
    onError: (err: Error) => {
      toast.error(`Error al revocar clave: ${err.message}`);
    },
  });
};

export const useReissueKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { activationKey: string; newInstallId: string }) =>
      apiFetch<{ data: string; signature: string }>('/api/admin/reissue', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] });
    },
    onError: (err: Error) => {
      toast.error(`Error al reemitir: ${err.message}`);
    },
  });
};
