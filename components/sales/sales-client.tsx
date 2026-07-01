"use client"
import { useState, useEffect } from 'react'
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
import { Plus, Trash2, TrendingUp, Eye, UserPlus, Search, X, Loader2 } from 'lucide-react'
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
interface Lot { lot_num: number; quantity_remaining: number; unit_cost_pen: number; received_at: string }

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
  const [lotsCache, setLotsCache] = useState<Record<string, Lot[]>>({})

  // Customer state
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [docQuery, setDocQuery] = useState('')
  const [docType, setDocType] = useState<'DNI' | 'RUC'>('DNI')
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', email: '', phone: '', address: '' })
  const [customerLoading, setCustomerLoading] = useState(false)
  const [consultaLoading, setConsultaLoading] = useState(false)

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

  async function handleDocSearch() {
    if (!docQuery.trim()) return
    if (matchedCustomer) {
      setSelectedCustomer(matchedCustomer)
      return
    }
    // Consultar RENIEC/SUNAT via apiperu.dev
    setConsultaLoading(true)
    try {
      const res = await fetch(`/api/consulta-documento?documento=${docQuery.trim()}`)
      const data = await res.json()
      if (res.ok && data.nombre) {
        const nombreCompleto = data.tipo === 'DNI'
          ? `${data.nombre} ${data.apellidos ?? ''}`.trim()
          : data.nombre
        setNewCustomerForm({ name: nombreCompleto, email: '', phone: '', address: data.direccion ?? '' })
        toast({ title: `${data.tipo === 'DNI' ? 'RENIEC' : 'SUNAT'}: ${nombreCompleto}`, description: 'Datos precargados — revisa y confirma', variant: 'success' })
      } else {
        setNewCustomerForm({ name: '', email: '', phone: '', address: '' })
      }
    } catch {
      setNewCustomerForm({ name: '', email: '', phone: '', address: '' })
    }
    setConsultaLoading(false)
    setNewCustomerOpen(true)
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
      address: newCustomerForm.address.trim() || null,
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

  async function fetchLots(productId: string) {
    if (!productId || lotsCache[productId]) return
    const { data } = await supabase
      .from('inventory_lots')
      .select('quantity_remaining, unit_cost_pen, received_at')
      .eq('product_id', productId)
      .gt('quantity_remaining', 0)
      .order('received_at', { ascending: true })
    if (data) {
      const lots = data.map((l, i) => ({ lot_num: i + 1, ...l }))
      setLotsCache(prev => ({ ...prev, [productId]: lots }))
    }
  }

  function handleProductSelect(idx: number, productId: string) {
    updateItem(idx, 'product_id', productId)
    if (productId) fetchLots(productId)
  }

  function addItem() { setItems(i => [...i, { product_id: '', quantity: 1, unit_price: 0 }]) }
  function removeItem(idx: number) { setItems(i => i.filter((_, j) => j !== idx)) }
  function updateItem(idx: number, field: keyof SaleItem, value: string | number) {
    setItems(i => i.map((item, j) => j === idx ? { ...item, [field]: value } : item))
  }

  const subtotalOriginal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const subtotalPen = convertToSoles(subtotalOriginal, currency, exchangeRate)

  // Simulación FIFO por producto: distribuye cantidad pedida entre lotes disponibles
  function simulateFifo(productId: string, quantity: number, unitPricePen: number) {
    const lots = lotsCache[productId] ?? []
    const result: { lot_num: number; qty: number; unit_cost_pen: number; revenue: number; cost: number; profit: number; isLoss: boolean }[] = []
    let remaining = quantity
    for (const lot of lots) {
      if (remaining <= 0) break
      const used = Math.min(remaining, lot.quantity_remaining)
      const revenue = used * unitPricePen
      const cost = used * lot.unit_cost_pen
      result.push({ lot_num: lot.lot_num, qty: used, unit_cost_pen: lot.unit_cost_pen, revenue, cost, profit: revenue - cost, isLoss: lot.unit_cost_pen > unitPricePen })
      remaining -= used
    }
    return result
  }

  // Calcular costo FIFO real si hay lotes cargados, sino usar promedio
  const itemsWithFifo = items.map(i => {
    const unitPricePen = convertToSoles(i.unit_price, currency, exchangeRate)
    const fifoRows = i.product_id && lotsCache[i.product_id] ? simulateFifo(i.product_id, i.quantity, unitPricePen) : []
    const fifoAvailable = fifoRows.length > 0
    const estimatedCostItem = fifoAvailable
      ? fifoRows.reduce((s, r) => s + r.cost, 0)
      : i.quantity * (availableProducts.find(p => p.id === i.product_id)?.avg_cost_pen ?? 0)
    return { ...i, unitPricePen, fifoRows, fifoAvailable, estimatedCostItem }
  })

  const estimatedCost = itemsWithFifo.reduce((s, i) => s + i.estimatedCostItem, 0)
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
                    <Button variant="outline" onClick={handleDocSearch} disabled={!docQuery.trim() || consultaLoading}>
                      {consultaLoading
                        ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Consultando...</>
                        : <><Search className="h-4 w-4 mr-1" /> Buscar</>}
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
              {itemsWithFifo.map((item, idx) => {
                const prod = availableProducts.find(p => p.id === item.product_id)
                return (
                  <div key={idx} className="space-y-1">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5 space-y-1">
                        {idx === 0 && <Label className="text-xs">Producto (nombre o SKU)</Label>}
                        <Combobox
                          options={productOptions}
                          value={item.product_id}
                          onSelect={v => handleProductSelect(idx, v)}
                          placeholder="Buscar producto..."
                        />
                        {prod && (
                          <div className="text-xs text-gray-400">
                            Stock: {prod.current_stock} · Costo prom: {formatCurrency(prod.avg_cost_pen)}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 space-y-1">
                        {idx === 0 && <Label className="text-xs">Cantidad</Label>}
                        <Input type="number" min={1} max={prod?.current_stock} value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                      </div>
                      <div className="col-span-3 space-y-1">
                        {idx === 0 && <Label className="text-xs">Precio unit. ({currency === 'USD' ? '$' : 'S/'})</Label>}
                        <Input type="number" min={0} step="0.01" value={item.unit_price}
                          onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} />
                      </div>
                      <div className="col-span-2">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={items.length === 1}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>

                    {/* Desglose FIFO por lote */}
                    {item.fifoRows.length > 0 && (
                      <div className="ml-1 border-l-2 border-amber-200 pl-3 space-y-0.5">
                        {item.fifoRows.map(row => (
                          <div key={row.lot_num} className={`flex items-center justify-between text-[11px] font-mono rounded px-2 py-0.5 ${row.isLoss ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
                            <span className="font-semibold">LT-{String(row.lot_num).padStart(2,'0')}</span>
                            <span>{row.qty}u × {formatCurrency(row.unit_cost_pen)}</span>
                            <span>costo: {formatCurrency(row.cost)}</span>
                            <span className={row.isLoss ? 'text-red-600 font-bold' : 'text-green-700'}>
                              util: {formatCurrency(row.profit)}
                            </span>
                            {row.isLoss && <span className="text-red-600 font-bold">⚠ bajo costo</span>}
                          </div>
                        ))}
                        <div className="flex justify-between text-[11px] text-gray-500 px-2 pt-0.5 border-t border-amber-100">
                          <span>Subtotal producto</span>
                          <span className="font-semibold">venta: {formatCurrency(item.fifoRows.reduce((s,r)=>s+r.revenue,0))}</span>
                          <span>costo: {formatCurrency(item.estimatedCostItem)}</span>
                          <span className={item.fifoRows.reduce((s,r)=>s+r.profit,0) < 0 ? 'text-red-600 font-bold' : 'text-green-700 font-semibold'}>
                            util: {formatCurrency(item.fifoRows.reduce((s,r)=>s+r.profit,0))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <Card className={estimatedProfit < 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-100'}>
              <CardContent className="pt-4 pb-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal venta:</span>
                  <span className="font-semibold">{formatCurrency(subtotalPen)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Costo estimado (FIFO):</span>
                  <span>{formatCurrency(estimatedCost)}</span>
                </div>
                <div className={`flex justify-between font-bold border-t pt-1 ${estimatedProfit < 0 ? 'text-red-600 border-red-200' : 'text-green-700 border-green-200'}`}>
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
            <div className={`rounded px-3 py-2 text-sm border ${newCustomerForm.name ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
              <span className="font-medium">{docType}:</span> {docQuery}
              {newCustomerForm.name
                ? <span className="text-green-700 ml-2">✓ Datos obtenidos de {docType === 'DNI' ? 'RENIEC' : 'SUNAT'}</span>
                : <span className="text-gray-500 ml-2">— no encontrado, ingresa manualmente</span>}
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
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input placeholder="Av. Lima 123" value={newCustomerForm.address} onChange={e => setNewCustomerForm(f => ({ ...f, address: e.target.value }))} />
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
