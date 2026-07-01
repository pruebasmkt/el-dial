import { formatCurrency } from '@/lib/utils'
import type { TopProduct } from '@/types'

export function TopProductsTable({ data }: { data: TopProduct[] }) {
  if (!data.length) return <p className="text-sm text-gray-400 text-center py-4">Sin datos</p>
  return (
    <div className="space-y-3">
      {data.map((p, i) => (
        <div key={p.id} className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{p.name}</p>
            <p className="text-xs text-gray-400">{p.total_qty_sold} unid.</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{formatCurrency(Number(p.total_revenue_pen))}</p>
            <p className="text-xs text-green-600">+{formatCurrency(Number(p.total_profit_pen))}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
