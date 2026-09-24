import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAddWarehouseMember, useCreateWarehouse, useWarehouses } from '../api/warehouses';
import { useOrgUsers } from '../api/users';
import { ApiError } from '../api/client';
import { Button, Card, EmptyState, ErrorText, Field, Input, Select } from '../components/ui';
import type { Role } from '../api/types';

function CreateWarehouseForm() {
  const { user } = useAuth();
  const create = useCreateWarehouse();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (user?.role !== 'ADMIN') return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ name, address: address || undefined });
      setName('');
      setAddress('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create warehouse');
    }
  }

  return (
    <Card title="New warehouse">
      <form className="flex items-end gap-3" onSubmit={onSubmit}>
        <div className="flex-1">
          <Field label="Name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Pune DC" />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="Address (optional)">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Pune, MH" />
          </Field>
        </div>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating...' : 'Create'}
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function AddMemberRow({ warehouseId }: { warehouseId: string }) {
  const users = useOrgUsers();
  const addMember = useAddWarehouseMember(warehouseId);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!userId) return;
    try {
      await addMember.mutateAsync({ userId, role: role || undefined });
      setUserId('');
      setRole('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add member');
    }
  }

  if (!users.data) return null;

  return (
    <form className="mt-3 flex items-end gap-2 border-t border-slate-100 pt-3" onSubmit={onSubmit}>
      <div className="flex-1">
        <Field label="Add member">
          <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Select a user...</option>
            {users.data.data.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email} ({u.role})
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="w-40">
        <Field label="Role override">
          <Select value={role} onChange={(e) => setRole(e.target.value as Role | '')}>
            <option value="">(use org role)</option>
            <option value="ADMIN">ADMIN</option>
            <option value="MANAGER">MANAGER</option>
            <option value="STAFF">STAFF</option>
          </Select>
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={addMember.isPending || !userId}>
        Add
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}

export function Warehouses() {
  const { user } = useAuth();
  const warehouses = useWarehouses();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Warehouses</h1>

      <CreateWarehouseForm />

      <Card title="All warehouses">
        {!warehouses.data || warehouses.data.data.length === 0 ? (
          <EmptyState>No warehouses yet.</EmptyState>
        ) : (
          <div className="divide-y divide-slate-100">
            {warehouses.data.data.map((w) => (
              <div key={w.id} className="py-3">
                <button
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setExpanded(expanded === w.id ? null : w.id)}
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900">{w.name}</div>
                    <div className="text-xs text-slate-500">{w.address ?? 'No address on file'}</div>
                  </div>
                  <span className="text-xs text-slate-400">{expanded === w.id ? 'Hide' : 'Members'}</span>
                </button>
                {expanded === w.id && user?.role === 'ADMIN' && <AddMemberRow warehouseId={w.id} />}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
