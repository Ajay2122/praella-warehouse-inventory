import { useState, type FormEvent } from 'react';
import { useWarehouses } from '../api/warehouses';
import { useProducts } from '../api/catalog';
import { useRecordMovement, useStockLevels, useStockMovements, useTransferStock } from '../api/stock';
import { ApiError } from '../api/client';
import { Button, Card, EmptyState, ErrorText, Field, Input, Select } from '../components/ui';
import { Badge } from '../components/Badge';
import type { MovementType } from '../api/types';

function RecordMovementForm({ warehouseId }: { warehouseId: string }) {
  const products = useProducts();
  const record = useRecordMovement();
  const [productId, setProductId] = useState('');
  const [type, setType] = useState<MovementType>('INBOUND');
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    try {
      await record.mutateAsync({
        productId,
        warehouseId,
        type: type as 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT',
        quantity: Number(quantity),
        direction: type === 'ADJUSTMENT' ? direction : undefined,
      });
      setQuantity('');
      setOkMsg('Movement recorded.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record movement');
    }
  }

  return (
    <Card title="Record a movement">
      <form className="grid grid-cols-4 gap-3" onSubmit={onSubmit}>
        <Field label="Product">
          <Select required value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select...</option>
            {products.data?.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as MovementType)}>
            <option value="INBOUND">Inbound</option>
            <option value="OUTBOUND">Outbound</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </Select>
        </Field>
        {type === 'ADJUSTMENT' && (
          <Field label="Direction">
            <Select value={direction} onChange={(e) => setDirection(e.target.value as 'IN' | 'OUT')}>
              <option value="IN">Increase</option>
              <option value="OUT">Decrease</option>
            </Select>
          </Field>
        )}
        <Field label="Quantity">
          <Input required type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={record.isPending || !productId}>
            {record.isPending ? 'Recording...' : 'Record'}
          </Button>
        </div>
      </form>
      <ErrorText>{error}</ErrorText>
      {okMsg && <p className="mt-2 text-sm text-green-600">{okMsg}</p>}
    </Card>
  );
}

function TransferForm({ defaultFromWarehouseId }: { defaultFromWarehouseId: string }) {
  const warehouses = useWarehouses();
  const products = useProducts();
  const transfer = useTransferStock();
  const [productId, setProductId] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState(defaultFromWarehouseId);
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    try {
      await transfer.mutateAsync({ productId, fromWarehouseId, toWarehouseId, quantity: Number(quantity) });
      setQuantity('');
      setOkMsg('Transfer applied.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Transfer failed');
    }
  }

  return (
    <Card title="Transfer between warehouses">
      <form className="grid grid-cols-5 gap-3" onSubmit={onSubmit}>
        <Field label="Product">
          <Select required value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select...</option>
            {products.data?.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From">
          <Select required value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)}>
            <option value="">Select...</option>
            {warehouses.data?.data.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="To">
          <Select required value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
            <option value="">Select...</option>
            {warehouses.data?.data
              .filter((w) => w.id !== fromWarehouseId)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Quantity">
          <Input required type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={transfer.isPending || !productId || !toWarehouseId}>
            {transfer.isPending ? 'Transferring...' : 'Transfer'}
          </Button>
        </div>
      </form>
      <ErrorText>{error}</ErrorText>
      {okMsg && <p className="mt-2 text-sm text-green-600">{okMsg}</p>}
    </Card>
  );
}

export function Inventory() {
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = useState('');
  const levels = useStockLevels({ warehouseId: warehouseId || undefined });
  const movements = useStockMovements({ warehouseId: warehouseId || undefined });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Inventory</h1>
        <div className="w-64">
          <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">All warehouses I can access</option>
            {warehouses.data?.data.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {warehouseId && <RecordMovementForm warehouseId={warehouseId} />}
      {warehouseId && <TransferForm defaultFromWarehouseId={warehouseId} />}

      <Card title="Stock levels">
        {!levels.data || levels.data.data.length === 0 ? (
          <EmptyState>Select a warehouse, or no stock recorded yet.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">Product</th>
                <th className="pb-2">Warehouse</th>
                <th className="pb-2 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {levels.data.data.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="py-2">{l.product?.name}</td>
                  <td className="py-2 text-slate-500">{l.warehouse?.name}</td>
                  <td className="py-2 text-right font-medium">{l.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Recent movements">
        {!movements.data || movements.data.data.length === 0 ? (
          <EmptyState>No movements yet.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">When</th>
                <th className="pb-2">Product</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">From</th>
                <th className="pb-2">To</th>
                <th className="pb-2 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {movements.data.data.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="py-2 text-slate-500">{new Date(m.createdAt).toLocaleString()}</td>
                  <td className="py-2">{m.product?.name}</td>
                  <td className="py-2">
                    <Badge value={m.type} />
                  </td>
                  <td className="py-2 text-slate-500">{m.fromWarehouse?.name ?? '-'}</td>
                  <td className="py-2 text-slate-500">{m.toWarehouse?.name ?? '-'}</td>
                  <td className="py-2 text-right">{m.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
