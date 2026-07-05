import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  // Contar productos con stock bajo para badge en sidebar
  const { count } = await supabase
    .from('v_inventory_status')
    .select('*', { count: 'exact', head: true })
    .in('stock_status', ['stock_bajo', 'sin_stock'])

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar lowStockCount={count ?? 0} />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
