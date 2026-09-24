import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { Category, Paginated, Product, Single, Supplier } from './types';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiRequest<Paginated<Category>>('/api/categories', { query: { pageSize: 100 } }),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiRequest<Single<Category>>('/api/categories', { method: 'POST', body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: () => apiRequest<Paginated<Supplier>>('/api/suppliers', { query: { pageSize: 100 } }),
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiRequest<Single<Supplier>>('/api/suppliers', { method: 'POST', body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useProducts(params: { search?: string; categoryId?: string; warehouseId?: string } = {}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () =>
      apiRequest<Paginated<Product>>('/api/products', { query: { pageSize: 100, ...params } }),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sku: string; name: string; categoryId: string; supplierId: string; unitPrice: number }) =>
      apiRequest<Single<Product>>('/api/products', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}
