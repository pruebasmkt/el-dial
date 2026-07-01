import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { convertToSoles } from '@/lib/utils'
import type { Currency } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { customer_id, customer_name, currency, exchange_rate, notes, items } = body as {
    customer_id?: string
    customer_name?: string
    currency: Currency
    exchange_rate: number
    notes?: string
    items: { product_id: string; quantity: number; unit_price: number }[]
  }

  if (!items?.length) return NextResponse.json({ error: 'Sin items' }, { status: 400 })

  const itemsPen = items.map(i => ({
    ...i,
    unit_price_pen: convertToSoles(i.unit_price, currency, exchange_rate),
  }))

  const subtotal = itemsPen.reduce((s, i) => s + i.quantity * i.unit_price_pen, 0)

  // Número correlativo con secuencia PostgreSQL
  const { data: seqData } = await supabase.rpc('nextval_sale')
  const sale_number = `VT-${String(seqData ?? Date.now()).padStart(6, '0')}`

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      sale_number,
      customer_id: customer_id || null,
      customer_name: customer_name || null,
      currency,
      exchange_rate,
      subtotal,
      total_cost_pen: 0,
      notes: notes || null,
    })
    .select()
    .single()

  if (saleErr || !sale) {
    return NextResponse.json({ error: saleErr?.message }, { status: 500 })
  }

  let totalCostPen = 0

  for (const item of itemsPen) {
    const { data: saleItem, error: siErr } = await supabase
      .from('sale_items')
      .insert({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price_pen: item.unit_price_pen,
        unit_cost_pen: 0,
      })
      .select()
      .single()

    if (siErr || !saleItem) {
      await supabase.from('sales').delete().eq('id', sale.id)
      return NextResponse.json({ error: siErr?.message ?? 'Error creando item' }, { status: 500 })
    }

    const { data: unitCost, error: fifoErr } = await supabase
      .rpc('process_sale_item_fifo', {
        p_sale_item_id: saleItem.id,
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      })

    if (fifoErr) {
      await supabase.from('sales').delete().eq('id', sale.id)
      return NextResponse.json({ error: fifoErr.message }, { status: 400 })
    }

    const itemCostPen = Number(unitCost) * item.quantity
    totalCostPen += itemCostPen

    await supabase
      .from('sale_items')
      .update({ unit_cost_pen: Number(unitCost) })
      .eq('id', saleItem.id)
  }

  await supabase
    .from('sales')
    .update({ total_cost_pen: totalCostPen })
    .eq('id', sale.id)

  return NextResponse.json({ success: true, sale_id: sale.id, sale_number })
}
