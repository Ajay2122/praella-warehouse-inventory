import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { Paginated, PurchaseOrder, SalesOrder, Single } from './types';

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => apiRequest<Paginated<PurchaseOrder>>('/api/purchase-orders', { query: { pageSize: 50 } }),
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      warehouseId: string;
      supplierId: string;
      lines: { productId: string; quantity: number; unitCost: number }[];
    }) => apiRequest<Single<PurchaseOrder>>('/api/purchase-orders', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
  });
}

function invalidatePO(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['purchase-orders'] });
  qc.invalidateQueries({ queryKey: ['stock-levels'] });
  qc.invalidateQueries({ queryKey: ['stock-movements'] });
  qc.invalidateQueries({ queryKey: ['low-stock-alerts'] });
}

export function usePurchaseOrderAction(action: 'confirm' | 'receive' | 'cancel') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<Single<PurchaseOrder>>(`/api/purchase-orders/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => invalidatePO(qc),
  });
}

export function useSalesOrders() {
  return useQuery({
    queryKey: ['sales-orders'],
    queryFn: () => apiRequest<Paginated<SalesOrder>>('/api/sales-orders', { query: { pageSize: 50 } }),
  });
}

export function useCreateSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { warehouseId: string; lines: { productId: string; quantity: number; unitPrice: number }[] }) =>
      apiRequest<Single<SalesOrder>>('/api/sales-orders', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-orders'] }),
  });
}

function invalidateSO(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['sales-orders'] });
  qc.invalidateQueries({ queryKey: ['stock-levels'] });
  qc.invalidateQueries({ queryKey: ['stock-movements'] });
  qc.invalidateQueries({ queryKey: ['low-stock-alerts'] });
}

export function useSalesOrderAction(action: 'confirm' | 'dispatch' | 'cancel') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<Single<SalesOrder>>(`/api/sales-orders/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => invalidateSO(qc),
  });
}
