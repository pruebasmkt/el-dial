"use client"
import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'

export function NavigationProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const timer1 = useRef<ReturnType<typeof setTimeout>>()
  const timer2 = useRef<ReturnType<typeof setTimeout>>()

  // Navegación completada → llenar y ocultar
  useEffect(() => {
    setWidth(100)
    timer1.current = setTimeout(() => { setVisible(false); setWidth(0) }, 400)
    return () => clearTimeout(timer1.current)
  }, [pathname])

  // Detectar clicks en links internos → iniciar barra
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const link = (e.target as Element).closest('a')
      if (!link) return
      const href = link.getAttribute('href')
      if (!href || href.startsWith('http') || href.startsWith('#') || href === pathname) return
      setVisible(true)
      setWidth(20)
      timer2.current = setTimeout(() => setWidth(60), 150)
    }
    document.addEventListener('click', handleClick)
    return () => { document.removeEventListener('click', handleClick); clearTimeout(timer2.current) }
  }, [pathname])

  if (!visible && width === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none">
      <div
        className="h-full bg-blue-500 transition-all ease-out"
        style={{ width: `${width}%`, transitionDuration: width === 100 ? '300ms' : '500ms' }}
      />
    </div>
  )
}
