"use client"
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Package, ShoppingCart, TrendingUp,
  Boxes, BarChart3, Zap, LogOut, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/products', label: 'Productos', icon: Package },
  { href: '/purchases', label: 'Compras', icon: ShoppingCart },
  { href: '/sales', label: 'Ventas', icon: TrendingUp },
  { href: '/inventory', label: 'Inventario', icon: Boxes },
  { href: '/reports', label: 'Reportes', icon: BarChart3 },
]

interface SidebarProps {
  lowStockCount?: number
}

export function Sidebar({ lowStockCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col min-h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-lg">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">El Dial</h1>
            <p className="text-xs text-gray-400 mt-0.5">Gestión de Tienda</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {label === 'Inventario' && lowStockCount > 0 && (
                <span className="ml-auto flex items-center gap-1 bg-yellow-500 text-yellow-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {lowStockCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-700">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Cerrar Sesión
        </Button>
      </div>
    </aside>
  )
}
