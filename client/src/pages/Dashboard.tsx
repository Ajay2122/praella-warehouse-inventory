import { Link } from 'react-router-dom';
import { useWarehouses } from '../api/warehouses';
import { useProducts } from '../api/catalog';
import { useLowStockAlerts } from '../api/stock';
import { usePurchaseOrders, useSalesOrders } from '../api/orders';
import { Card, EmptyState } from '../components/ui';
import { Badge } from '../components/Badge';

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export function Dashboard() {
  const warehouses = useWarehouses();
  const products = useProducts();
  const alerts = useLowStockAlerts();
  const purchaseOrders = usePurchaseOrders();
  const salesOrders = useSalesOrders();

  const pendingPOs = purchaseOrders.data?.data.filter((po) => po.status === 'CONFIRMED').length ?? 0;
  const pendingSOs = salesOrders.data?.data.filter((so) => so.status === 'CONFIRMED').length ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Warehouses" value={warehouses.data?.pagination.total ?? '-'} />
        <StatCard label="Products" value={products.data?.pagination.total ?? '-'} />
        <StatCard label="Low stock alerts" value={alerts.data?.pagination.total ?? '-'} />
        <StatCard label="POs awaiting receipt" value={pendingPOs} />
        <StatCard label="SOs awaiting dispatch" value={pendingSOs} />
      </div>

      <Card title="Low stock alerts">
        {!alerts.data || alerts.data.data.length === 0 ? (
          <EmptyState>Nothing below its replenishment threshold right now.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">Product</th>
                <th className="pb-2">Warehouse</th>
                <th className="pb-2">Current</th>
                <th className="pb-2">Threshold</th>
              </tr>
            </thead>
            <tbody>
              {alerts.data.data.map((a, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-2">{a.product.name}</td>
                  <td className="py-2">{a.warehouse.name}</td>
                  <td className="py-2">
                    <Badge value={String(a.currentQuantity)} />
                  </td>
                  <td className="py-2 text-slate-500">{a.minThreshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="flex gap-3 text-sm">
        <Link to="/warehouses" className="text-slate-600 underline hover:text-slate-900">
          Manage warehouses
        </Link>
        <Link to="/inventory" className="text-slate-600 underline hover:text-slate-900">
          Go to inventory
        </Link>
      </div>
    </div>
  );
}
