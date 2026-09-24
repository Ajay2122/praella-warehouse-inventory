import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { LowStockAlert, Paginated, StockLevel, StockMovement } from './types';

export function useStockLevels(params: { warehouseId?: string; productId?: string } = {}) {
  return useQuery({
    queryKey: ['stock-levels', params],
    queryFn: () => apiRequest<Paginated<StockLevel>>('/api/stock/levels', { query: { pageSize: 100, ...params } }),
  });
}

export function useStockMovements(params: { warehouseId?: string; productId?: string } = {}) {
  return useQuery({
    queryKey: ['stock-movements', params],
    queryFn: () =>
      apiRequest<Paginated<StockMovement>>('/api/stock/movements', {
        query: { pageSize: 50, ...params },
      }),
  });
}

export function useLowStockAlerts() {
  return useQuery({
    queryKey: ['low-stock-alerts'],
    queryFn: () => apiRequest<Paginated<LowStockAlert>>('/api/replenishment-rules/alerts', { query: { pageSize: 100 } }),
  });
}

function invalidateStock(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['stock-levels'] });
  qc.invalidateQueries({ queryKey: ['stock-movements'] });
  qc.invalidateQueries({ queryKey: ['low-stock-alerts'] });
}

export function useRecordMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      productId: string;
      warehouseId: string;
      type: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT';
      quantity: number;
      direction?: 'IN' | 'OUT';
    }) => apiRequest<{ success: true; data: StockMovement }>('/api/stock/movements', { method: 'POST', body: input }),
    onSuccess: () => invalidateStock(qc),
  });
}

export function useTransferStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number }) =>
      apiRequest('/api/transfers', { method: 'POST', body: input }),
    onSuccess: () => invalidateStock(qc),
  });
}

export function useUpsertReplenishmentRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; warehouseId: string; minThreshold: number }) =>
      apiRequest('/api/replenishment-rules', { method: 'PUT', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['low-stock-alerts'] }),
  });
}
