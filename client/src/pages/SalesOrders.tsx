import { useState, type FormEvent } from 'react';
import { useWarehouses } from '../api/warehouses';
import { useProducts } from '../api/catalog';
import { useCreateSalesOrder, useSalesOrderAction, useSalesOrders } from '../api/orders';
import { ApiError } from '../api/client';
import { Button, Card, EmptyState, ErrorText, Field, Input, Select } from '../components/ui';
import { Badge } from '../components/Badge';

interface Line {
  productId: string;
  quantity: string;
  unitPrice: string;
}

function CreateSalesOrderForm() {
  const warehouses = useWarehouses();
  const products = useProducts();
  const create = useCreateSalesOrder();

  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState<Line[]>([{ productId: '', quantity: '', unitPrice: '' }]);
  const [error, setError] = useState<string | null>(null);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        warehouseId,
        lines: lines
          .filter((l) => l.productId)
          .map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
      });
      setWarehouseId('');
      setLines([{ productId: '', quantity: '', unitPrice: '' }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create sales order');
    }
  }

  return (
    <Card title="New sales order (dispatch)">
      <form className="space-y-3" onSubmit={onSubmit}>
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
                placeholder="Unit price"
                value={line.unitPrice}
                onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
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
            onClick={() => setLines((prev) => [...prev, { productId: '', quantity: '', unitPrice: '' }])}
          >
            + add line
          </button>
        </div>

        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating...' : 'Create sales order'}
        </Button>
        <ErrorText>{error}</ErrorText>
      </form>
    </Card>
  );
}

export function SalesOrders() {
  const orders = useSalesOrders();
  const confirm = useSalesOrderAction('confirm');
  const dispatch = useSalesOrderAction('dispatch');
  const cancel = useSalesOrderAction('cancel');
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
      <h1 className="text-lg font-semibold text-slate-900">Sales Orders</h1>

      <CreateSalesOrderForm />

      <ErrorText>{actionError}</ErrorText>

      <Card title="All sales orders">
        {!orders.data || orders.data.data.length === 0 ? (
          <EmptyState>No sales orders yet.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">Warehouse</th>
                <th className="pb-2">Lines</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.data.data.map((so) => (
                <tr key={so.id} className="border-t border-slate-100">
                  <td className="py-2">{so.warehouse?.name}</td>
                  <td className="py-2 text-slate-500">{so.lines.length} line(s)</td>
                  <td className="py-2">
                    <Badge value={so.status} />
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {so.status === 'DRAFT' && (
                        <Button
                          variant="secondary"
                          onClick={() => safeAction(() => confirm.mutateAsync(so.id))}
                          disabled={confirm.isPending}
                        >
                          Confirm
                        </Button>
                      )}
                      {so.status === 'CONFIRMED' && (
                        <Button onClick={() => safeAction(() => dispatch.mutateAsync(so.id))} disabled={dispatch.isPending}>
                          Dispatch
                        </Button>
                      )}
                      {(so.status === 'DRAFT' || so.status === 'CONFIRMED') && (
                        <Button
                          variant="danger"
                          onClick={() => safeAction(() => cancel.mutateAsync(so.id))}
                          disabled={cancel.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
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
