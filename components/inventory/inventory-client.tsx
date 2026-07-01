"use client"
import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, AlertTriangle, Layers, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency, formatDate, STOCK_STATUS_LABELS, STOCK_STATUS_COLORS } from '@/lib/utils'
import type { InventoryStatus, InventoryLot, StockStatus } from '@/types'

interface Props {
  inventory: InventoryStatus[]
  lots: (InventoryLot & { products?: { name: string; sku: string } })[]
}

export function InventoryClient({ inventory, lots }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StockStatus | 'all'>('all')
  const [selectedProduct, setSelectedProduct] = useState<InventoryStatus | null>(null)
  const [sortField, setSortField] = useState<'name' | 'current_stock' | 'inventory_value_pen'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filtered = useMemo(() => {
    let data = inventory.filter(p =>
      (filter === 'all' || p.stock_status === filter) &&
      (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
    )
    data = [...data].sort((a, b) => {
      const av = a[sortField]
      const bv = b[sortField]
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return data
  }, [inventory, filter, search, sortField, sortDir])

  const totalValue = inventory.reduce((s, p) => s + Number(p.inventory_value_pen), 0)
  const alertCount = inventory.filter(p => p.stock_status !== 'ok').length

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function SortIcon({ field }: { field: typeof sortField }) {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />
  }

  const productLots = lots.filter(l => l.product_id === selectedProduct?.id)

  return (
    <>
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Valor Total Inventario</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totalValue)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Productos</p>
          <p className="text-xl font-bold mt-1">{inventory.length}</p>
        </div>
        <div className={`rounded-lg border p-4 ${alertCount > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            {alertCount > 0 && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
            Alertas de Stock
          </p>
          <p className={`text-xl font-bold mt-1 ${alertCount > 0 ? 'text-yellow-700' : ''}`}>{alertCount}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Buscar producto..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={v => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="sin_stock">Sin stock</SelectItem>
            <SelectItem value="stock_bajo">Stock bajo</SelectItem>
            <SelectItem value="ok">Normal</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-400">{filtered.length} productos</span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                Nombre <SortIcon field="name" />
              </TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort('current_stock')}>
                Stock <SortIcon field="current_stock" />
              </TableHead>
              <TableHead className="text-center">Mínimo</TableHead>
              <TableHead className="text-right">Costo Prom.</TableHead>
              <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('inventory_value_pen')}>
                Valor S/ <SortIcon field="inventory_value_pen" />
              </TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(p => (
              <TableRow key={p.id} className={p.stock_status === 'sin_stock' ? 'bg-red-50' : p.stock_status === 'stock_bajo' ? 'bg-yellow-50' : ''}>
                <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-sm text-gray-500">{p.category_name ?? '—'}</TableCell>
                <TableCell className="text-center font-bold">
                  {p.current_stock}
                  {p.stock_status !== 'ok' && <AlertTriangle className="inline h-3 w-3 text-yellow-500 ml-1" />}
                </TableCell>
                <TableCell className="text-center text-gray-400">{p.min_stock}</TableCell>
                <TableCell className="text-right text-sm">{formatCurrency(Number(p.avg_cost_pen))}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(Number(p.inventory_value_pen))}</TableCell>
                <TableCell className="text-center">
                  <Badge className={STOCK_STATUS_COLORS[p.stock_status]}>
                    {STOCK_STATUS_LABELS[p.stock_status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(p)}>
                    <Layers className="h-3 w-3 mr-1" /> Lotes
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog lotes FIFO */}
      {selectedProduct && (
        <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Lotes FIFO — {selectedProduct.name}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-500">Los lotes se consumirán en orden de llegada (más antiguo primero)</p>
            {productLots.length === 0 ? (
              <p className="text-center py-8 text-gray-400">No hay lotes con stock disponible</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Fecha Recepción</TableHead>
                    <TableHead className="text-center">Recibido</TableHead>
                    <TableHead className="text-center">Disponible</TableHead>
                    <TableHead className="text-right">Costo Unit. S/</TableHead>
                    <TableHead className="text-right">Valor S/</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productLots.map((lot, i) => (
                    <TableRow key={lot.id} className={i === 0 ? 'bg-blue-50 font-medium' : ''}>
                      <TableCell>
                        {i === 0 ? <Badge variant="default">Próximo</Badge> : `#${i + 1}`}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(lot.received_at)}</TableCell>
                      <TableCell className="text-center">{lot.quantity_received}</TableCell>
                      <TableCell className="text-center font-bold">{lot.quantity_remaining}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(lot.unit_cost_pen))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(lot.quantity_remaining) * Number(lot.unit_cost_pen))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
