"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2, ShoppingCart, CheckCircle, Package } from 'lucide-react'
import { formatCurrency, formatDate, PO_STATUS_LABELS, PO_STATUS_COLORS, convertToSoles } from '@/lib/utils'
import type { PurchaseOrder, Product, Supplier, Currency } from '@/types'

interface OrderItem { product_id: string; quantity: number; unit_cost_original: number }

interface Props {
  initialOrders: PurchaseOrder[]
  products: Pick<Product, 'id' | 'name' | 'sku' | 'unit'>[]
  suppliers: Supplier[]
}

export function PurchasesClient({ initialOrders, products, suppliers }: Props) {
  const [open, setOpen] = useState(false)
  const [detailOrder, setDetailOrder] = useState<PurchaseOrder | null>(null)
  const [currency, setCurrency] = useState<Currency>('PEN')
  const [exchangeRate, setExchangeRate] = useState(3.75)
  const [supplierName, setSupplierName] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<OrderItem[]>([{ product_id: '', quantity: 1, unit_cost_original: 0 }])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  function addItem() { setItems(i => [...i, { product_id: '', quantity: 1, unit_cost_original: 0 }]) }
  function removeItem(idx: number) { setItems(i => i.filter((_, j) => j !== idx)) }
  function updateItem(idx: number, field: keyof OrderItem, value: string | number) {
    setItems(i => i.map((item, j) => j === idx ? { ...item, [field]: value } : item))
  }

  const subtotalOriginal = items.reduce((s, i) => s + i.quantity * i.unit_cost_original, 0)
  const subtotalPen = convertToSoles(subtotalOriginal, currency, exchangeRate)

  async function handleCreate() {
    if (!supplierName || items.some(i => !i.product_id || i.quantity <= 0 || i.unit_cost_original <= 0)) {
      toast({ title: 'Datos incompletos', description: 'Completa todos los campos', variant: 'destructive' })
      return
    }
    setLoading(true)
    const { data: order, error: orderErr } = await supabase
      .from('purchase_orders')
      .insert({
        order_number: '', // será reemplazado por trigger o función
        supplier_name: supplierName,
        order_date: orderDate,
        currency,
        exchange_rate: exchangeRate,
        subtotal_original: subtotalOriginal,
        subtotal_pen: subtotalPen,
        notes: notes || null,
      })
      .select()
      .single()

    // Actualizar con número de orden
    if (order) {
      // Asignar número de orden único
      await supabase
        .from('purchase_orders')
        .update({ order_number: `OC-${Date.now()}` })
        .eq('id', order.id)
        .eq('order_number', '')

      const itemsPayload = items.map(i => ({
        purchase_order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_cost_original: i.unit_cost_original,
        unit_cost_pen: convertToSoles(i.unit_cost_original, currency, exchangeRate),
      }))
      const { error: itemsErr } = await supabase.from('purchase_order_items').insert(itemsPayload)

      if (orderErr || itemsErr) {
        toast({ title: 'Error', description: (orderErr || itemsErr)?.message, variant: 'destructive' })
      } else {
        toast({ title: 'Orden creada exitosamente', variant: 'success' })
        setOpen(false)
        resetForm()
        router.refresh()
      }
    }
    setLoading(false)
  }

  async function confirmOrder(id: string) {
    await supabase.from('purchase_orders').update({ status: 'confirmed' }).eq('id', id)
    router.refresh()
    toast({ title: 'Orden confirmada' })
  }

  async function receiveOrder(id: string) {
    const { error } = await supabase.rpc('receive_purchase_order', { p_order_id: id })
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' })
    else {
      toast({ title: 'Compra recibida — inventario actualizado', variant: 'success' })
      router.refresh()
    }
  }

  function resetForm() {
    setSupplierName(''); setNotes(''); setCurrency('PEN'); setExchangeRate(3.75)
    setOrderDate(new Date().toISOString().split('T')[0])
    setItems([{ product_id: '', quantity: 1, unit_cost_original: 0 }])
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Nueva Orden de Compra
        </Button>
      </div>

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Orden</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Moneda</TableHead>
              <TableHead className="text-right">Total (S/)</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No hay órdenes de compra
                </TableCell>
              </TableRow>
            ) : initialOrders.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-sm font-semibold">{o.order_number}</TableCell>
                <TableCell>{o.supplier_name}</TableCell>
                <TableCell className="text-sm text-gray-500">{formatDate(o.order_date)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{o.currency}</Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(Number(o.subtotal_pen))}</TableCell>
                <TableCell className="text-center">
                  <Badge className={PO_STATUS_COLORS[o.status]}>{PO_STATUS_LABELS[o.status]}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setDetailOrder(o)}>Ver</Button>
                    {o.status === 'draft' && (
                      <Button variant="outline" size="sm" onClick={() => confirmOrder(o.id)}>Confirmar</Button>
                    )}
                    {o.status === 'confirmed' && (
                      <Button size="sm" onClick={() => receiveOrder(o.id)}>
                        <Package className="h-3 w-3 mr-1" /> Recibir
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog crear orden */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Orden de Compra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Proveedor *</Label>
                <Input placeholder="Nombre del proveedor" value={supplierName} onChange={e => setSupplierName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
              </div>
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
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5 space-y-1">
                      {idx === 0 && <Label className="text-xs">Producto</Label>}
                      <Select value={item.product_id} onValueChange={v => updateItem(idx, 'product_id', v)}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
                        <SelectContent>
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name} — {p.sku}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      {idx === 0 && <Label className="text-xs">Cantidad</Label>}
                      <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                    </div>
                    <div className="col-span-3 space-y-1">
                      {idx === 0 && <Label className="text-xs">Costo unit. ({currency === 'USD' ? '$' : 'S/'})</Label>}
                      <Input type="number" min={0} step="0.01" value={item.unit_cost_original} onChange={e => updateItem(idx, 'unit_cost_original', Number(e.target.value))} />
                    </div>
                    <div className="col-span-2 flex gap-1">
                      {idx === 0 && <div className="h-5" />}
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={items.length === 1}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Card className="bg-blue-50 border-blue-100">
              <CardContent className="pt-4 pb-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal en {currency === 'USD' ? 'dólares' : 'soles'}:</span>
                  <span className="font-semibold">{currency === 'USD' ? `$ ${subtotalOriginal.toFixed(2)}` : formatCurrency(subtotalOriginal)}</span>
                </div>
                {currency === 'USD' && (
                  <div className="flex justify-between text-sm mt-1">
                    <span>Equivalente en soles (TC: {exchangeRate}):</span>
                    <span className="font-bold text-blue-700">{formatCurrency(subtotalPen)}</span>
                  </div>
                )}
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
              {loading ? 'Creando...' : 'Crear Orden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog detalle */}
      {detailOrder && (
        <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Orden {detailOrder.order_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Proveedor:</span> <span className="font-medium">{detailOrder.supplier_name}</span></div>
                <div><span className="text-gray-500">Fecha:</span> <span className="font-medium">{formatDate(detailOrder.order_date)}</span></div>
                <div><span className="text-gray-500">Moneda:</span> <Badge variant="outline">{detailOrder.currency}</Badge></div>
                <div><span className="text-gray-500">Estado:</span> <Badge className={PO_STATUS_COLORS[detailOrder.status]}>{PO_STATUS_LABELS[detailOrder.status]}</Badge></div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Cant.</TableHead>
                    <TableHead className="text-right">Costo Unit.</TableHead>
                    <TableHead className="text-right">Total S/</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailOrder.purchase_order_items?.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{(item as any).products?.name}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {detailOrder.currency === 'USD' ? `$ ${Number(item.unit_cost_original).toFixed(2)}` : formatCurrency(Number(item.unit_cost_original))}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(item.total_cost_pen))}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-bold">Total:</TableCell>
                    <TableCell className="text-right font-bold text-blue-700">{formatCurrency(Number(detailOrder.subtotal_pen))}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
