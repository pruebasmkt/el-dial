"use client"
import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { Printer, AlertTriangle, TrendingUp, Package } from 'lucide-react'
import type { SalesSummary, TopProduct, InventoryStatus } from '@/types'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']

interface TopCustomer {
  id: string; name: string; document_type: string; document_number: string
  total_sales: number; total_revenue_pen: number; total_profit_pen: number; profit_margin: number
}

interface LowStockItem {
  id: string; sku: string; name: string; unit: string
  current_stock: number; min_stock: number; stock_diff: number
  last_purchase_price: number | null; last_purchase_date: string | null
  last_supplier: string | null; supplier_phone: string | null
  supplier_email: string | null; supplier_contact: string | null
}

interface Props {
  salesSummary: SalesSummary[]
  topProducts: TopProduct[]
  inventory: InventoryStatus[]
  topCustomers: TopCustomer[]
  lowStock: LowStockItem[]
}

export function ReportsClient({ salesSummary, topProducts, inventory, topCustomers, lowStock }: Props) {
  const [tab, setTab] = useState<'ventas' | 'inventario'>('ventas')
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30')
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    const content = printRef.current
    if (!content) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`
      <html><head><title>Reporte Stock Bajo — El Dial</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; color: #111; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p.sub { color: #666; margin-bottom: 16px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1e3a5f; color: white; padding: 7px 10px; text-align: left; font-size: 11px; }
        td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
        tr:nth-child(even) td { background: #f9fafb; }
        .critico { color: #dc2626; font-weight: bold; }
        .badge-rojo { background: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
        .badge-amarillo { background: #fef9c3; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const periodDays = Number(period)
  const slicedSummary = salesSummary.slice(0, periodDays)

  const totalRevenue = slicedSummary.reduce((s, d) => s + Number(d.total_revenue_pen), 0)
  const totalProfit = slicedSummary.reduce((s, d) => s + Number(d.total_profit_pen), 0)
  const totalSales = slicedSummary.reduce((s, d) => s + Number(d.total_sales), 0)
  const avgMargin = totalRevenue > 0 ? totalProfit / totalRevenue : 0

  const chartData = [...slicedSummary].reverse().map(d => ({
    date: format(new Date(d.day), 'dd/MM', { locale: es }),
    Ventas: Number(d.total_revenue_pen),
    Utilidad: Number(d.total_profit_pen),
    Costo: Number(d.total_cost_pen),
  }))

  const pieData = topProducts.slice(0, 6).map(p => ({
    name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
    value: Number(p.total_revenue_pen),
  }))

  const invValue = inventory.reduce((s, p) => s + Number(p.inventory_value_pen), 0)

  return (
    <div className="space-y-6">
      {/* Pestañas principales */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('ventas')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'ventas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          <TrendingUp className="h-4 w-4" /> Ventas y Rentabilidad
        </button>
        <button
          onClick={() => setTab('inventario')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'inventario' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          <Package className="h-4 w-4" /> Inventario
          {lowStock.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{lowStock.length}</span>
          )}
        </button>
      </div>

      {/* ── TAB INVENTARIO ── */}
      {tab === 'inventario' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Productos con Stock Bajo</h2>
              <p className="text-sm text-gray-500">{lowStock.length} productos por debajo del stock mínimo</p>
            </div>
            <Button onClick={handlePrint} variant="outline" className="gap-2">
              <Printer className="h-4 w-4" /> Imprimir reporte
            </Button>
          </div>

          {/* Contenido imprimible */}
          <div ref={printRef}>
            <h1 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 4 }}>El Dial — Reporte de Stock Bajo</h1>
            <p className="sub" style={{ color: '#666', marginBottom: 16, fontSize: 11 }}>
              Generado el {format(new Date(), "dd 'de' MMMM yyyy, HH:mm", { locale: es })} · {lowStock.length} productos bajo mínimo
            </p>

            <div className="bg-white rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-900">
                    <TableHead className="text-white">SKU</TableHead>
                    <TableHead className="text-white">Producto</TableHead>
                    <TableHead className="text-white text-center">Stock Actual</TableHead>
                    <TableHead className="text-white text-center">Stock Mínimo</TableHead>
                    <TableHead className="text-white text-center">Déficit</TableHead>
                    <TableHead className="text-white text-right">Últ. Precio Compra</TableHead>
                    <TableHead className="text-white">Último Proveedor</TableHead>
                    <TableHead className="text-white">Contacto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-gray-400">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        Todos los productos tienen stock suficiente
                      </TableCell>
                    </TableRow>
                  ) : lowStock.map(item => {
                    const critico = item.current_stock === 0
                    return (
                      <TableRow key={item.id} className={critico ? 'bg-red-50' : ''}>
                        <TableCell className="font-mono text-xs text-gray-500">{item.sku}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{item.name}</div>
                          {critico && <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold"><AlertTriangle className="h-3 w-3" /> Sin stock</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold ${critico ? 'text-red-600' : 'text-orange-600'}`}>
                            {item.current_stock} {item.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-gray-600">{item.min_stock} {item.unit}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={critico ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'}>
                            {item.stock_diff} {item.unit}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.last_purchase_price ? formatCurrency(Number(item.last_purchase_price)) : '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium">{item.last_supplier ?? '—'}</div>
                          {item.last_purchase_date && (
                            <div className="text-xs text-gray-400">{format(new Date(item.last_purchase_date), 'dd/MM/yyyy')}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.supplier_contact && <div className="font-medium">{item.supplier_contact}</div>}
                          {item.supplier_phone && <div className="text-xs text-gray-500">{item.supplier_phone}</div>}
                          {item.supplier_email && <div className="text-xs text-blue-600">{item.supplier_email}</div>}
                          {!item.supplier_contact && !item.supplier_phone && !item.supplier_email && <span className="text-gray-400">—</span>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB VENTAS ── */}
      {tab === 'ventas' && <>
      {/* Selector de período */}
      <div className="flex gap-2">
        {(['7', '30', '90'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              period === p ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p === '7' ? 'Últimos 7 días' : p === '30' ? 'Últimos 30 días' : 'Últimos 90 días'}
          </button>
        ))}
      </div>

      {/* KPIs del período */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ingresos', value: formatCurrency(totalRevenue), sub: `${totalSales} ventas` },
          { label: 'Costo Total', value: formatCurrency(totalRevenue - totalProfit), sub: 'FIFO' },
          { label: 'Utilidad Bruta', value: formatCurrency(totalProfit), sub: '', highlight: true },
          { label: 'Margen Promedio', value: formatPercent(avgMargin), sub: 'sobre ventas', highlight: avgMargin > 0.25 },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-5 pb-4">
              <p className="text-sm text-gray-500">{kpi.label}</p>
              <p className={`text-xl font-bold mt-1 ${kpi.highlight ? 'text-green-700' : ''}`}>{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfica barras */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingresos vs Utilidad</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `S/${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name]} />
              <Legend />
              <Bar dataKey="Ventas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Utilidad" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top productos + pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Productos por Rentabilidad</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Utilidad</TableHead>
                  <TableHead className="text-center">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((p, i) => {
                  const margin = Number(p.total_revenue_pen) > 0
                    ? Number(p.total_profit_pen) / Number(p.total_revenue_pen)
                    : 0
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-gray-400 text-xs">{i + 1}</TableCell>
                      <TableCell className="text-sm font-medium">{p.name}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(Number(p.total_revenue_pen))}</TableCell>
                      <TableCell className="text-right text-sm text-green-700">{formatCurrency(Number(p.total_profit_pen))}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={margin > 0.2 ? 'success' : 'warning'}>{formatPercent(margin)}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Clientes — Mayor Facturación</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-center">Ventas</TableHead>
                    <TableHead className="text-right">Facturación</TableHead>
                    <TableHead className="text-right">Utilidad</TableHead>
                    <TableHead className="text-center">Margen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-4 text-gray-400 text-sm">Sin datos aún</TableCell></TableRow>
                  ) : topCustomers.slice(0, 10).map((c, i) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-gray-400 text-sm">{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.document_type}: {c.document_number}</div>
                      </TableCell>
                      <TableCell className="text-center text-sm">{c.total_sales}</TableCell>
                      <TableCell className="text-right font-medium text-sm">{formatCurrency(Number(c.total_revenue_pen))}</TableCell>
                      <TableCell className="text-right text-sm text-green-700">{formatCurrency(Number(c.total_profit_pen))}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={Number(c.profit_margin) > 0.2 ? 'success' : 'warning'}>{formatPercent(Number(c.profit_margin))}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Clientes — Más Rentables</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Utilidad</TableHead>
                    <TableHead className="text-center">Margen</TableHead>
                    <TableHead className="text-right">Facturación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...topCustomers].sort((a, b) => Number(b.total_profit_pen) - Number(a.total_profit_pen)).slice(0, 10).map((c, i) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-gray-400 text-sm">{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.document_type}: {c.document_number}</div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-700 text-sm">{formatCurrency(Number(c.total_profit_pen))}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={Number(c.profit_margin) > 0.2 ? 'success' : 'warning'}>{formatPercent(Number(c.profit_margin))}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-500">{formatCurrency(Number(c.total_revenue_pen))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribución de Ventas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Valor de Inventario (Top)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-3">Total: <span className="font-bold text-gray-900">{formatCurrency(invValue)}</span></p>
              <div className="space-y-2">
                {inventory.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{p.name}</p>
                      <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, (Number(p.inventory_value_pen) / invValue) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-medium shrink-0">{formatCurrency(Number(p.inventory_value_pen))}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </> }
    </div>
  )
}
