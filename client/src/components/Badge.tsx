const COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  RECEIVED: 'bg-green-100 text-green-700',
  DISPATCHED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  STAFF: 'bg-slate-100 text-slate-700',
  INBOUND: 'bg-green-100 text-green-700',
  OUTBOUND: 'bg-amber-100 text-amber-700',
  TRANSFER_OUT: 'bg-sky-100 text-sky-700',
  TRANSFER_IN: 'bg-sky-100 text-sky-700',
  ADJUSTMENT: 'bg-purple-100 text-purple-700',
};

export function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[value] ?? 'bg-slate-100 text-slate-700'}`}>
      {value}
    </span>
  );
}
