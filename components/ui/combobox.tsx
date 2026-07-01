"use client"
import { useState, useRef, useEffect } from 'react'
import { Input } from './input'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Option { value: string; label: string; sublabel?: string }

interface Props {
  options: Option[]
  value: string
  onSelect: (value: string) => void
  placeholder?: string
  className?: string
}

export function Combobox({ options, value, onSelect, placeholder = 'Buscar...', className }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = query.length < 1
    ? options.slice(0, 50)
    : options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sublabel ?? '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 50)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(opt: Option) {
    onSelect(opt.value)
    setOpen(false)
    setQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onSelect('')
    setQuery('')
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div
        className="flex items-center border rounded-md bg-white cursor-pointer px-3 py-2 text-sm min-h-[38px]"
        onClick={() => { setOpen(true) }}
      >
        {open ? (
          <>
            <Search className="h-3.5 w-3.5 text-gray-400 mr-2 shrink-0" />
            <input
              autoFocus
              className="flex-1 outline-none text-sm bg-transparent"
              placeholder={placeholder}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </>
        ) : selected ? (
          <>
            <span className="flex-1 truncate">{selected.label}</span>
            <X className="h-3.5 w-3.5 text-gray-400 ml-1 shrink-0" onClick={handleClear} />
          </>
        ) : (
          <>
            <Search className="h-3.5 w-3.5 text-gray-400 mr-2 shrink-0" />
            <span className="text-gray-400">{placeholder}</span>
          </>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-400 text-center">Sin resultados</div>
          ) : filtered.map(opt => (
            <div
              key={opt.value}
              className={cn(
                'px-3 py-2 text-sm cursor-pointer hover:bg-blue-50',
                opt.value === value && 'bg-blue-50 font-medium'
              )}
              onMouseDown={e => { e.preventDefault(); handleSelect(opt) }}
            >
              <div>{opt.label}</div>
              {opt.sublabel && <div className="text-xs text-gray-400">{opt.sublabel}</div>}
            </div>
          ))}
          {options.length > 50 && filtered.length === 50 && (
            <div className="px-3 py-2 text-xs text-gray-400 border-t text-center">
              Escribe para filtrar más resultados
            </div>
          )}
        </div>
      )}
    </div>
  )
}
