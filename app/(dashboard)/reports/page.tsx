import { createClient } from '@/lib/supabase/server'
import { ReportsClient } from '@/components/reports/reports-client'

export const revalidate = 0

export default async function ReportsPage() {
  const supabase = await createClient()
  const [{ data: salesSummary }, { data: topProducts }, { data: inventory }] = await Promise.all([
    supabase.from('v_sales_summary').select('*').order('day', { ascending: false }).limit(90),
    supabase.from('v_top_products').select('*').limit(20),
    supabase.from('v_inventory_status').select('*').order('inventory_value_pen', { ascending: false }).limit(20),
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-gray-500 text-sm">Análisis de ventas, rentabilidad e inventario</p>
      </div>
      <ReportsClient
        salesSummary={salesSummary ?? []}
        topProducts={topProducts ?? []}
        inventory={inventory ?? []}
      />
    </div>
  )
}
