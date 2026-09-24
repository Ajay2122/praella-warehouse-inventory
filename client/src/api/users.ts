import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { Single, User } from './types';

export function useOrgUsers(enabled = true) {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiRequest<Single<User[]>>('/api/users'),
    enabled,
  });
}
