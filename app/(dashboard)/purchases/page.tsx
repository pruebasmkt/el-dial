import { createClient } from '@/lib/supabase/server'
import { PurchasesClient } from '@/components/purchases/purchases-client'

export const revalidate = 0

export default async function PurchasesPage() {
  const supabase = await createClient()
  const [{ data: orders }, { data: products }, { data: suppliers }] = await Promise.all([
    supabase
      .from('purchase_orders')
      .select('*, purchase_order_items(*, products(name, sku, unit))')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('products').select('id, name, sku, unit').eq('is_active', true).order('name'),
    supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
        <p className="text-gray-500 text-sm">Órdenes de compra a proveedores</p>
      </div>
      <PurchasesClient
        initialOrders={orders ?? []}
        products={products ?? []}
        suppliers={suppliers ?? []}
      />
    </div>
  )
}
