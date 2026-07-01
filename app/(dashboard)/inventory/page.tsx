import { createClient } from '@/lib/supabase/server'
import { InventoryClient } from '@/components/inventory/inventory-client'

export const revalidate = 0

export default async function InventoryPage() {
  const supabase = await createClient()
  const [{ data: inventory }, { data: lots }] = await Promise.all([
    supabase
      .from('v_inventory_status')
      .select('*')
      .order('name'),
    supabase
      .from('inventory_lots')
      .select('*, products(name, sku)')
      .gt('quantity_remaining', 0)
      .order('received_at', { ascending: true }),
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <p className="text-gray-500 text-sm">Stock actual con lotes FIFO y alertas de reposición</p>
      </div>
      <InventoryClient inventory={inventory ?? []} lots={lots ?? []} />
    </div>
  )
}
