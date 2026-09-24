import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCategories, useCreateCategory, useCreateProduct, useCreateSupplier, useProducts, useSuppliers } from '../api/catalog';
import { ApiError } from '../api/client';
import { Button, Card, EmptyState, ErrorText, Field, Input, Select } from '../components/ui';

function QuickAdd({ label, onAdd }: { label: string; onAdd: (name: string) => Promise<unknown> }) {
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" className="text-xs text-slate-500 underline" onClick={() => setOpen(true)}>
        + new {label.toLowerCase()}
      </button>
    );
  }

  return (
    <div className="mt-1 flex gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${label} name`} />
      <Button
        type="button"
        variant="secondary"
        disabled={busy || !name}
        onClick={async () => {
          setBusy(true);
          try {
            await onAdd(name);
            setName('');
            setOpen(false);
          } finally {
            setBusy(false);
          }
        }}
      >
        Add
      </Button>
    </div>
  );
}

function CreateProductForm() {
  const { user } = useAuth();
  const categories = useCategories();
  const suppliers = useSuppliers();
  const createCategory = useCreateCategory();
  const createSupplier = useCreateSupplier();
  const createProduct = useCreateProduct();

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createProduct.mutateAsync({ sku, name, categoryId, supplierId, unitPrice: Number(unitPrice) });
      setSku('');
      setName('');
      setCategoryId('');
      setSupplierId('');
      setUnitPrice('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create product');
    }
  }

  return (
    <Card title="New product">
      <form className="grid grid-cols-5 gap-3" onSubmit={onSubmit}>
        <Field label="SKU">
          <Input required value={sku} onChange={(e) => setSku(e.target.value)} placeholder="IP15-128" />
        </Field>
        <Field label="Name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="iPhone 15" />
        </Field>
        <div>
          <Field label="Category">
            <Select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select...</option>
              {categories.data?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <QuickAdd label="Category" onAdd={(n) => createCategory.mutateAsync(n)} />
        </div>
        <div>
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
          <QuickAdd label="Supplier" onAdd={(n) => createSupplier.mutateAsync(n)} />
        </div>
        <Field label="Unit price">
          <Input required type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="799.00" />
        </Field>
        <div className="col-span-5">
          <Button type="submit" disabled={createProduct.isPending}>
            {createProduct.isPending ? 'Creating...' : 'Create product'}
          </Button>
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </Card>
  );
}

export function Products() {
  const [search, setSearch] = useState('');
  const products = useProducts({ search: search || undefined });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Products</h1>

      <CreateProductForm />

      <Card
        title="Catalog"
        action={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or SKU..."
            className="w-56"
          />
        }
      >
        {!products.data || products.data.data.length === 0 ? (
          <EmptyState>No products found.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">SKU</th>
                <th className="pb-2">Name</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Supplier</th>
                <th className="pb-2 text-right">Unit price</th>
              </tr>
            </thead>
            <tbody>
              {products.data.data.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="py-2 font-mono text-xs">{p.sku}</td>
                  <td className="py-2">{p.name}</td>
                  <td className="py-2 text-slate-500">{p.category?.name}</td>
                  <td className="py-2 text-slate-500">{p.supplier?.name}</td>
                  <td className="py-2 text-right">${p.unitPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
