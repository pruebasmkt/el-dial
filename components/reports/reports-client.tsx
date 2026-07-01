"use client"
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { SalesSummary, TopProduct, InventoryStatus } from '@/types'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']

interface TopCustomer {
  id: string; name: string; document_type: string; document_number: string
  total_sales: number; total_revenue_pen: number; total_profit_pen: number; profit_margin: number
}

interface Props {
  salesSummary: SalesSummary[]
  topProducts: TopProduct[]
  inventory: InventoryStatus[]
  topCustomers: TopCustomer[]
}

export function ReportsClient({ salesSummary, topProducts, inventory, topCustomers }: Props) {
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30')

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
    </div>
  )
}
