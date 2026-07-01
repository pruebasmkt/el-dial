import { createClient } from '@/lib/supabase/server'
import { SalesClient } from '@/components/sales/sales-client'

export const revalidate = 0

export default async function SalesPage() {
  const supabase = await createClient()
  const [{ data: sales }, { data: products }, { data: customers }] = await Promise.all([
    supabase
      .from('sales')
      .select('*, sale_items(*, products(name, sku))')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('v_inventory_status')
      .select('id, name, sku, unit, current_stock, avg_cost_pen')
      .gt('current_stock', 0)
      .order('name'),
    supabase
      .from('customers')
      .select('id, document_type, document_number, name, email, phone')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
        <p className="text-gray-500 text-sm">Registro de ventas con costo FIFO y utilidad real</p>
      </div>
      <SalesClient
        initialSales={sales ?? []}
        availableProducts={products ?? []}
        initialCustomers={customers ?? []}
      />
    </div>
  )
}
