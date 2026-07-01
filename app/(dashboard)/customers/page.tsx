import { createClient } from '@/lib/supabase/server'
import { CustomersClient } from '@/components/customers/customers-client'

export const revalidate = 0

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .order('name')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="text-gray-500 text-sm">Gestión de clientes y su historial de compras</p>
      </div>
      <CustomersClient initialCustomers={customers ?? []} />
    </div>
  )
}
