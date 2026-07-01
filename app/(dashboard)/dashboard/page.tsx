import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp, TrendingDown, ShoppingCart, Package,
  AlertTriangle, DollarSign, BarChart2, Boxes,
} from 'lucide-react'
import { SalesChart } from '@/components/dashboard/sales-chart'
import { TopProductsTable } from '@/components/dashboard/top-products-table'
import { StockAlerts } from '@/components/dashboard/stock-alerts'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = `${today.slice(0, 7)}-01`

  const [
    { data: todaySales },
    { data: monthSales },
    { data: inventoryStats },
    { data: salesChart },
    { data: topProducts },
    { data: stockAlerts },
  ] = await Promise.all([
    supabase
      .from('sales')
      .select('subtotal, total_cost_pen, total_profit_pen, profit_margin')
      .eq('status', 'completed')
      .gte('sale_date', today),
    supabase
      .from('sales')
      .select('subtotal, total_profit_pen')
      .eq('status', 'completed')
      .gte('sale_date', firstOfMonth),
    supabase
      .from('v_inventory_status')
      .select('stock_status, inventory_value_pen'),
    supabase
      .from('v_sales_summary')
      .select('*')
      .order('day', { ascending: false })
      .limit(30),
    supabase
      .from('v_top_products')
      .select('*')
      .limit(5),
    supabase
      .from('v_inventory_status')
      .select('*')
      .in('stock_status', ['stock_bajo', 'sin_stock'])
      .order('current_stock', { ascending: true })
      .limit(10),
  ])

  const todayRevenue = todaySales?.reduce((s, v) => s + Number(v.subtotal), 0) ?? 0
  const todayProfit = todaySales?.reduce((s, v) => s + Number(v.total_profit_pen), 0) ?? 0
  const todayCount = todaySales?.length ?? 0
  const todayMargin = todayCount > 0
    ? todaySales!.reduce((s, v) => s + Number(v.profit_margin), 0) / todayCount
    : 0

  const monthRevenue = monthSales?.reduce((s, v) => s + Number(v.subtotal), 0) ?? 0
  const monthProfit = monthSales?.reduce((s, v) => s + Number(v.total_profit_pen), 0) ?? 0

  const invValue = inventoryStats?.reduce((s, v) => s + Number(v.inventory_value_pen), 0) ?? 0
  const lowStockCount = inventoryStats?.filter(v => v.stock_status === 'stock_bajo').length ?? 0
  const outStockCount = inventoryStats?.filter(v => v.stock_status === 'sin_stock').length ?? 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm">Resumen general de El Dial</p>
      </div>

      {/* KPIs Hoy */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ventas Hoy"
          value={formatCurrency(todayRevenue)}
          sub={`${todayCount} transacciones`}
          icon={ShoppingCart}
          color="blue"
        />
        <StatCard
          title="Utilidad Hoy"
          value={formatCurrency(todayProfit)}
          sub={`Margen: ${formatPercent(todayMargin)}`}
          icon={todayProfit >= 0 ? TrendingUp : TrendingDown}
          color={todayProfit >= 0 ? 'green' : 'red'}
        />
        <StatCard
          title="Ventas del Mes"
          value={formatCurrency(monthRevenue)}
          sub={`Utilidad: ${formatCurrency(monthProfit)}`}
          icon={BarChart2}
          color="purple"
        />
        <StatCard
          title="Valor Inventario"
          value={formatCurrency(invValue)}
          sub={
            <span className="flex gap-2">
              {outStockCount > 0 && <Badge variant="destructive">{outStockCount} sin stock</Badge>}
              {lowStockCount > 0 && <Badge variant="warning">{lowStockCount} bajo</Badge>}
            </span>
          }
          icon={Boxes}
          color="orange"
        />
      </div>

      {/* Alertas de stock */}
      {stockAlerts && stockAlerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <h2 className="font-semibold text-yellow-800">Alertas de Stock</h2>
          </div>
          <StockAlerts items={stockAlerts} />
        </div>
      )}

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ventas últimos 30 días</CardTitle>
            </CardHeader>
            <CardContent>
              <SalesChart data={salesChart ?? []} />
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 5 Productos</CardTitle>
            </CardHeader>
            <CardContent>
              <TopProductsTable data={topProducts ?? []} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title, value, sub, icon: Icon, color,
}: {
  title: string
  value: string
  sub: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  color: 'blue' | 'green' | 'red' | 'purple' | 'orange'
}) {
  const colorMap = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <div className="text-sm text-gray-500 mt-1">{sub}</div>
          </div>
          <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
