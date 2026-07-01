"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2, TrendingUp, Eye, UserPlus, Search, X } from 'lucide-react'
import { formatCurrency, formatDateTime, formatPercent, convertToSoles } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Sale, Currency } from '@/types'

interface AvailableProduct {
  id: string; name: string; sku: string; unit: string; current_stock: number; avg_cost_pen: number
}
interface Customer {
  id: string; document_type: string; document_number: string; name: string; email?: string; phone?: string
}
interface SaleItem { product_id: string; quantity: number; unit_price: number }

interface Props {
  initialSales: Sale[]
  availableProducts: AvailableProduct[]
  initialCustomers: Customer[]
}

export function SalesClient({ initialSales, availableProducts, initialCustomers }: Props) {
  const [open, setOpen] = useState(false)
  const [detailSale, setDetailSale] = useState<Sale | null>(null)
  const [currency, setCurrency] = useState<Currency>('PEN')
  const [exchangeRate, setExchangeRate] = useState(3.75)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<SaleItem[]>([{ product_id: '', quantity: 1, unit_price: 0 }])
  const [loading, setLoading] = useState(false)

  // Customer state
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [docQuery, setDocQuery] = useState('')
  const [docType, setDocType] = useState<'DNI' | 'RUC'>('DNI')
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', email: '', phone: '' })
  const [customerLoading, setCustomerLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const productOptions = availableProducts.map(p => ({
    value: p.id,
    label: p.name,
    sublabel: `SKU: ${p.sku} · Stock: ${p.current_stock}`
  }))

  const matchedCustomer = customers.find(
    c => c.document_type === docType && c.document_number === docQuery.trim()
  )

  function handleDocSearch() {
    if (!docQuery.trim()) return
    if (matchedCustomer) {
      setSelectedCustomer(matchedCustomer)
    } else {
      setNewCustomerOpen(true)
      setNewCustomerForm({ name: '', email: '', phone: '' })
    }
  }

  function clearCustomer() {
    setSelectedCustomer(null)
    setDocQuery('')
  }

  async function handleCreateCustomer() {
    if (!newCustomerForm.name.trim() || !docQuery.trim()) return
    setCustomerLoading(true)
    const { data, error } = await supabase.from('customers').insert({
      document_type: docType,
      document_number: docQuery.trim(),
      name: newCustomerForm.name.trim(),
      email: newCustomerForm.email.trim() || null,
      phone: newCustomerForm.phone.trim() || null,
    }).select().single()

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else if (data) {
      setCustomers(prev => [...prev, data])
      setSelectedCustomer(data)
      setNewCustomerOpen(false)
      toast({ title: 'Cliente creado', variant: 'success' })
    }
    setCustomerLoading(false)
  }

  function addItem() { setItems(i => [...i, { product_id: '', quantity: 1, unit_price: 0 }]) }
  function removeItem(idx: number) { setItems(i => i.filter((_, j) => j !== idx)) }
  function updateItem(idx: number, field: keyof SaleItem, value: string | number) {
    setItems(i => i.map((item, j) => j === idx ? { ...item, [field]: value } : item))
  }

  const subtotalOriginal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const subtotalPen = convertToSoles(subtotalOriginal, currency, exchangeRate)
  const estimatedCost = items.reduce((s, i) => {
    const prod = availableProducts.find(p => p.id === i.product_id)
    return s + i.quantity * (prod?.avg_cost_pen ?? 0)
  }, 0)
  const estimatedProfit = subtotalPen - estimatedCost
  const estimatedMargin = subtotalPen > 0 ? estimatedProfit / subtotalPen : 0

  async function handleCreate() {
    if (items.some(i => !i.product_id || i.quantity <= 0 || i.unit_price <= 0)) {
      toast({ title: 'Datos incompletos', description: 'Completa todos los campos de los productos', variant: 'destructive' })
      return
    }
    for (const item of items) {
      const prod = availableProducts.find(p => p.id === item.product_id)
      if (prod && item.quantity > prod.current_stock) {
        toast({ title: 'Stock insuficiente', description: `${prod.name}: solo hay ${prod.current_stock} unidades`, variant: 'destructive' })
        return
      }
    }
    setLoading(true)
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: selectedCustomer?.id ?? null,
        customer_name: selectedCustomer?.name ?? null,
        currency, exchange_rate: exchangeRate, notes, items
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast({ title: 'Error al registrar venta', description: data.error, variant: 'destructive' })
    } else {
      toast({ title: `Venta ${data.sale_number} registrada`, description: 'Inventario actualizado con FIFO', variant: 'success' })
      setOpen(false)
      resetForm()
      router.refresh()
    }
    setLoading(false)
  }

  function resetForm() {
    setSelectedCustomer(null); setDocQuery(''); setDocType('DNI')
    setNotes(''); setCurrency('PEN'); setExchangeRate(3.75)
    setItems([{ product_id: '', quantity: 1, unit_price: 0 }])
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Nueva Venta
        </Button>
      </div>

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Venta</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Ingresos S/</TableHead>
              <TableHead className="text-right">Costo S/</TableHead>
              <TableHead className="text-right">Utilidad S/</TableHead>
              <TableHead className="text-center">Margen</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-400">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No hay ventas registradas
                </TableCell>
              </TableRow>
            ) : initialSales.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-sm font-semibold">{s.sale_number}</TableCell>
                <TableCell className="text-sm">{s.customer_name ?? '—'}</TableCell>
                <TableCell className="text-sm text-gray-500">{formatDateTime(s.sale_date)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(Number(s.subtotal))}</TableCell>
                <TableCell className="text-right text-gray-500">{formatCurrency(Number(s.total_cost_pen))}</TableCell>
                <TableCell className="text-right font-semibold text-green-700">{formatCurrency(Number(s.total_profit_pen))}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={Number(s.profit_margin) > 0.2 ? 'success' : 'warning'}>
                    {formatPercent(Number(s.profit_margin))}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setDetailSale(s)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog nueva venta */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Cliente con DNI/RUC */}
            <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
              <Label className="text-sm font-semibold">Cliente</Label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-white border rounded-md px-3 py-2">
                  <div>
                    <div className="font-medium text-sm">{selectedCustomer.name}</div>
                    <div className="text-xs text-gray-500">
                      {selectedCustomer.document_type}: {selectedCustomer.document_number}
                      {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={clearCustomer}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Select value={docType} onValueChange={v => setDocType(v as 'DNI' | 'RUC')}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DNI">DNI</SelectItem>
                        <SelectItem value="RUC">RUC</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder={docType === 'DNI' ? '12345678' : '20123456789'}
                      value={docQuery}
                      onChange={e => setDocQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleDocSearch()}
                      className="flex-1"
                      maxLength={docType === 'DNI' ? 8 : 11}
                    />
                    <Button variant="outline" onClick={handleDocSearch} disabled={!docQuery.trim()}>
                      <Search className="h-4 w-4 mr-1" /> Buscar
                    </Button>
                  </div>
                  {docQuery && matchedCustomer && (
                    <button
                      className="w-full text-left px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm hover:bg-blue-100"
                      onClick={() => setSelectedCustomer(matchedCustomer)}
                    >
                      <span className="font-medium">{matchedCustomer.name}</span>
                      <span className="text-gray-500 ml-2">{matchedCustomer.document_type}: {matchedCustomer.document_number}</span>
                    </button>
                  )}
                  <p className="text-xs text-gray-400">Opcional — deja vacío para venta sin cliente identificado</p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select value={currency} onValueChange={v => setCurrency(v as Currency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PEN">Soles (S/)</SelectItem>
                    <SelectItem value="USD">Dólares ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {currency === 'USD' && (
                <div className="space-y-1.5">
                  <Label>Tipo de Cambio</Label>
                  <Input type="number" step="0.01" value={exchangeRate} onChange={e => setExchangeRate(Number(e.target.value))} />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Productos</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar
                </Button>
              </div>
              {items.map((item, idx) => {
                const prod = availableProducts.find(p => p.id === item.product_id)
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5 space-y-1">
                      {idx === 0 && <Label className="text-xs">Producto (nombre o SKU)</Label>}
                      <Combobox
                        options={productOptions}
                        value={item.product_id}
                        onSelect={v => updateItem(idx, 'product_id', v)}
                        placeholder="Buscar producto..."
                      />
                      {prod && <p className="text-xs text-gray-400">Costo prom: {formatCurrency(prod.avg_cost_pen)} · Stock: {prod.current_stock}</p>}
                    </div>
                    <div className="col-span-2 space-y-1">
                      {idx === 0 && <Label className="text-xs">Cantidad</Label>}
                      <Input type="number" min={1} max={prod?.current_stock} value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                    </div>
                    <div className="col-span-3 space-y-1">
                      {idx === 0 && <Label className="text-xs">Precio unit. ({currency === 'USD' ? '$' : 'S/'})</Label>}
                      <Input type="number" min={0} step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} />
                    </div>
                    <div className="col-span-2">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={items.length === 1}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            <Card className="bg-green-50 border-green-100">
              <CardContent className="pt-4 pb-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal venta:</span>
                  <span className="font-semibold">{formatCurrency(subtotalPen)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Costo estimado (FIFO):</span>
                  <span>{formatCurrency(estimatedCost)}</span>
                </div>
                <div className="flex justify-between font-bold text-green-700 border-t border-green-200 pt-1">
                  <span>Utilidad estimada:</span>
                  <span>{formatCurrency(estimatedProfit)} ({formatPercent(estimatedMargin)})</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input placeholder="Observaciones opcionales" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? 'Procesando FIFO...' : 'Registrar Venta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog crear cliente nuevo */}
      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle><UserPlus className="inline h-4 w-4 mr-2" />Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm">
              <span className="font-medium">{docType}:</span> {docQuery} — no encontrado en base de datos
            </div>
            <div className="space-y-1.5">
              <Label>Nombre / Razón Social *</Label>
              <Input placeholder="Juan Pérez" value={newCustomerForm.name} onChange={e => setNewCustomerForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input placeholder="999 999 999" value={newCustomerForm.phone} onChange={e => setNewCustomerForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input placeholder="correo@email.com" value={newCustomerForm.email} onChange={e => setNewCustomerForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCustomerOpen(false)}>Continuar sin cliente</Button>
            <Button onClick={handleCreateCustomer} disabled={customerLoading || !newCustomerForm.name.trim()}>
              {customerLoading ? 'Guardando...' : 'Crear y Seleccionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog detalle venta */}
      {detailSale && (
        <Dialog open={!!detailSale} onOpenChange={() => setDetailSale(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Venta {detailSale.sale_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Cliente:</span> {detailSale.customer_name ?? '—'}</div>
                <div><span className="text-gray-500">Fecha:</span> {formatDateTime(detailSale.sale_date)}</div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Cant.</TableHead>
                    <TableHead className="text-right">Precio S/</TableHead>
                    <TableHead className="text-right">Costo S/</TableHead>
                    <TableHead className="text-right">Utilidad S/</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailSale.sale_items?.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{(item as any).products?.name}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(item.total_price_pen))}</TableCell>
                      <TableCell className="text-right text-gray-500">{formatCurrency(Number(item.total_cost_pen))}</TableCell>
                      <TableCell className="text-right text-green-700 font-medium">{formatCurrency(Number(item.profit_pen))}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={2}>TOTAL</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(detailSale.subtotal))}</TableCell>
                    <TableCell className="text-right text-gray-500">{formatCurrency(Number(detailSale.total_cost_pen))}</TableCell>
                    <TableCell className="text-right text-green-700">{formatCurrency(Number(detailSale.total_profit_pen))}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className="text-right text-sm text-gray-500">
                Margen: <span className="font-bold text-green-700">{formatPercent(Number(detailSale.profit_margin))}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
