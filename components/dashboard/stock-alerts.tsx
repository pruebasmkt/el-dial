import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { InventoryStatus } from '@/types'

export function StockAlerts({ items }: { items: InventoryStatus[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {items.map(item => (
        <div key={item.id} className="flex items-center justify-between bg-white rounded-md px-3 py-2 text-sm border border-yellow-100">
          <div className="min-w-0">
            <p className="font-medium truncate">{item.name}</p>
            <p className="text-xs text-gray-400">{item.sku}</p>
          </div>
          <div className="ml-2 text-right shrink-0">
            <Badge variant={item.stock_status === 'sin_stock' ? 'destructive' : 'warning'}>
              {item.current_stock}/{item.min_stock}
            </Badge>
          </div>
        </div>
      ))}
      <Link href="/dashboard/inventory" className="flex items-center justify-center text-xs text-yellow-700 hover:underline col-span-full mt-1">
        Ver inventario completo →
      </Link>
    </div>
  )
}
