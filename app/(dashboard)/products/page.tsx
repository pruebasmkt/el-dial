import { createClient } from '@/lib/supabase/server'
import { ProductsClient } from '@/components/products/products-client'

export const revalidate = 0

export default async function ProductsPage() {
  const supabase = await createClient()
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from('products')
      .select('*, categories(name)')
      .order('name'),
    supabase.from('categories').select('*').order('name'),
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
        <p className="text-gray-500 text-sm">Catálogo de productos de El Dial</p>
      </div>
      <ProductsClient initialProducts={products ?? []} categories={categories ?? []} />
    </div>
  )
}
