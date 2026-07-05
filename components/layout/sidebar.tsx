"use client"
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Package, ShoppingCart, TrendingUp,
  Boxes, BarChart3, LogOut, AlertTriangle, Users, Menu, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/products', label: 'Productos', icon: Package },
  { href: '/purchases', label: 'Compras', icon: ShoppingCart },
  { href: '/sales', label: 'Ventas', icon: TrendingUp },
  { href: '/customers', label: 'Clientes', icon: Users },
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
  const [open, setOpen] = useState(false)

  // Cierra el menú cuando termina la navegación (fallback)
  useEffect(() => { setOpen(false) }, [pathname])

  // Bloquea scroll del body cuando el menú está abierto en mobile
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navContent = (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="El Dial" width={36} height={36} className="rounded-lg" />
          <div>
            <h1 className="font-bold text-base leading-none">El Dial</h1>
            <p className="text-xs text-gray-400 mt-0.5">Gestión de Tienda</p>
          </div>
        </div>
        {/* Botón cerrar solo en mobile */}
        <button
          className="md:hidden text-gray-400 hover:text-white p-1"
          onClick={() => setOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors',
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
      <div className="p-3 border-t border-gray-700">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Cerrar Sesión
        </Button>
      </div>
    </>
  )

  return (
    <>
      {/* ── TOPBAR MOBILE ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 text-white flex items-center px-4 h-14 gap-3 border-b border-gray-700">
        <button
          onClick={() => setOpen(true)}
          className="text-gray-300 hover:text-white p-1"
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6" />
        </button>
        <Image src="/logo.png" alt="El Dial" width={28} height={28} className="rounded" />
        <span className="font-bold text-sm">El Dial</span>
        {lowStockCount > 0 && (
          <span className="ml-auto flex items-center gap-1 bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
            <AlertTriangle className="h-3 w-3" /> {lowStockCount}
          </span>
        )}
      </header>

      {/* ── OVERLAY MOBILE ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── SIDEBAR DRAWER MOBILE ── */}
      <aside
        className={cn(
          'md:hidden fixed top-0 left-0 z-50 h-full w-64 bg-gray-900 text-white flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {navContent}
      </aside>

      {/* ── SIDEBAR DESKTOP (fijo) ── */}
      <aside className="hidden md:flex w-64 bg-gray-900 text-white flex-col min-h-screen shrink-0">
        {navContent}
      </aside>
    </>
  )
}
