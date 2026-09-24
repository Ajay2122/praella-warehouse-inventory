import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { Paginated, Single, Warehouse } from './types';

export function useWarehouses() {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: () => apiRequest<Paginated<Warehouse>>('/api/warehouses', { query: { pageSize: 100 } }),
  });
}

export function useWarehouse(id: string | undefined) {
  return useQuery({
    queryKey: ['warehouses', id],
    queryFn: () => apiRequest<Single<Warehouse>>(`/api/warehouses/${id}`),
    enabled: !!id,
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; address?: string }) =>
      apiRequest<Single<Warehouse>>('/api/warehouses', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouses'] }),
  });
}

export function useAddWarehouseMember(warehouseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role?: string }) =>
      apiRequest(`/api/warehouses/${warehouseId}/members`, { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouses', warehouseId] }),
  });
}
