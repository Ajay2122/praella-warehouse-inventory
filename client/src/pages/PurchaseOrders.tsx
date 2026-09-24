import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useWarehouses } from '../api/warehouses';
import { useProducts, useSuppliers } from '../api/catalog';
import { useCreatePurchaseOrder, usePurchaseOrderAction, usePurchaseOrders } from '../api/orders';
import { ApiError } from '../api/client';
import { Button, Card, EmptyState, ErrorText, Field, Input, Select } from '../components/ui';
import { Badge } from '../components/Badge';

interface Line {
  productId: string;
  quantity: string;
  unitCost: string;
}

function CreatePurchaseOrderForm() {
  const { user } = useAuth();
  const warehouses = useWarehouses();
  const suppliers = useSuppliers();
  const products = useProducts();
  const create = useCreatePurchaseOrder();

  const [warehouseId, setWarehouseId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<Line[]>([{ productId: '', quantity: '', unitCost: '' }]);
  const [error, setError] = useState<string | null>(null);

  if (user?.role === 'STAFF') return null;

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        warehouseId,
        supplierId,
        lines: lines
          .filter((l) => l.productId)
          .map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })),
      });
      setWarehouseId('');
      setSupplierId('');
      setLines([{ productId: '', quantity: '', unitCost: '' }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create purchase order');
    }
  }

  return (
    <Card title="New purchase order (inbound)">
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Warehouse">
            <Select required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Select...</option>
              {warehouses.data?.data.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Supplier">
            <Select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Select...</option>
              {suppliers.data?.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-4 gap-2">
              <Select value={line.productId} onChange={(e) => updateLine(i, { productId: e.target.value })}>
                <option value="">Product...</option>
                {products.data?.data.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min="1"
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => updateLine(i, { quantity: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Unit cost"
                value={line.unitCost}
                onChange={(e) => updateLine(i, { unitCost: e.target.value })}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={lines.length === 1}
              >
                Remove
              </Button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs text-slate-500 underline"
            onClick={() => setLines((prev) => [...prev, { productId: '', quantity: '', unitCost: '' }])}
          >
            + add line
          </button>
        </div>

        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating...' : 'Create purchase order'}
        </Button>
        <ErrorText>{error}</ErrorText>
      </form>
    </Card>
  );
}

export function PurchaseOrders() {
  const { user } = useAuth();
  const orders = usePurchaseOrders();
  const confirm = usePurchaseOrderAction('confirm');
  const receive = usePurchaseOrderAction('receive');
  const cancel = usePurchaseOrderAction('cancel');
  const [actionError, setActionError] = useState<string | null>(null);

  async function safeAction(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action failed');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Purchase Orders</h1>

      <CreatePurchaseOrderForm />

      <ErrorText>{actionError}</ErrorText>

      <Card title="All purchase orders">
        {!orders.data || orders.data.data.length === 0 ? (
          <EmptyState>No purchase orders yet.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">Warehouse</th>
                <th className="pb-2">Supplier</th>
                <th className="pb-2">Lines</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.data.data.map((po) => (
                <tr key={po.id} className="border-t border-slate-100">
                  <td className="py-2">{po.warehouse?.name}</td>
                  <td className="py-2 text-slate-500">{po.supplier?.name}</td>
                  <td className="py-2 text-slate-500">{po.lines.length} line(s)</td>
                  <td className="py-2">
                    <Badge value={po.status} />
                  </td>
                  <td className="py-2 text-right">
                    {user?.role !== 'STAFF' && (
                      <div className="flex justify-end gap-2">
                        {po.status === 'DRAFT' && (
                          <Button
                            variant="secondary"
                            onClick={() => safeAction(() => confirm.mutateAsync(po.id))}
                            disabled={confirm.isPending}
                          >
                            Confirm
                          </Button>
                        )}
                        {po.status === 'CONFIRMED' && (
                          <Button onClick={() => safeAction(() => receive.mutateAsync(po.id))} disabled={receive.isPending}>
                            Receive
                          </Button>
                        )}
                        {(po.status === 'DRAFT' || po.status === 'CONFIRMED') && (
                          <Button
                            variant="danger"
                            onClick={() => safeAction(() => cancel.mutateAsync(po.id))}
                            disabled={cancel.isPending}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
