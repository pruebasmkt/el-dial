// ============================================================
// TIPOS CENTRALES - El Dial
// ============================================================

export type Currency = 'PEN' | 'USD'
export type StockStatus = 'ok' | 'stock_bajo' | 'sin_stock'
export type POStatus = 'draft' | 'confirmed' | 'received' | 'cancelled'
export type SaleStatus = 'completed' | 'cancelled' | 'returned'

export interface Category {
  id: string
  name: string
  description?: string
  created_at: string
}

export interface Product {
  id: string
  sku: string
  name: string
  description?: string
  category_id?: string
  unit: string
  min_stock: number
  current_stock: number
  is_active: boolean
  created_at: string
  updated_at: string
  // joined
  categories?: Category
}

export interface Supplier {
  id: string
  name: string
  contact_name?: string
  phone?: string
  email?: string
  address?: string
  is_active: boolean
  created_at: string
}

export interface PurchaseOrder {
  id: string
  order_number: string
  supplier_id?: string
  supplier_name: string
  order_date: string
  currency: Currency
  exchange_rate: number
  subtotal_original: number
  subtotal_pen: number
  status: POStatus
  notes?: string
  created_at: string
  updated_at: string
  // joined
  purchase_order_items?: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string
  quantity: number
  unit_cost_original: number
  unit_cost_pen: number
  total_cost_pen: number
  // joined
  products?: Product
}

export interface InventoryLot {
  id: string
  product_id: string
  purchase_order_item_id?: string
  quantity_received: number
  quantity_remaining: number
  unit_cost_pen: number
  received_at: string
  created_at: string
}

export interface Sale {
  id: string
  sale_number: string
  sale_date: string
  customer_name?: string
  currency: Currency
  exchange_rate: number
  subtotal: number
  total_cost_pen: number
  total_profit_pen: number
  profit_margin: number
  status: SaleStatus
  notes?: string
  created_at: string
  // joined
  sale_items?: SaleItem[]
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price_pen: number
  total_price_pen: number
  unit_cost_pen: number
  total_cost_pen: number
  profit_pen: number
  // joined
  products?: Product
  sale_item_lots?: SaleItemLot[]
}

export interface SaleItemLot {
  id: string
  sale_item_id: string
  inventory_lot_id: string
  quantity_used: number
  unit_cost_pen: number
}

// ============================================================
// VISTAS
// ============================================================

export interface InventoryStatus {
  id: string
  sku: string
  name: string
  unit: string
  current_stock: number
  min_stock: number
  is_active: boolean
  category_name?: string
  stock_status: StockStatus
  avg_cost_pen: number
  inventory_value_pen: number
}

export interface SalesSummary {
  day: string
  total_sales: number
  total_revenue_pen: number
  total_cost_pen: number
  total_profit_pen: number
  avg_margin: number
}

export interface TopProduct {
  id: string
  name: string
  sku: string
  total_qty_sold: number
  total_revenue_pen: number
  total_cost_pen: number
  total_profit_pen: number
}

// ============================================================
// FORM TYPES
// ============================================================

export interface NewPurchaseOrderForm {
  supplier_name: string
  supplier_id?: string
  order_date: string
  currency: Currency
  exchange_rate: number
  notes?: string
  items: {
    product_id: string
    quantity: number
    unit_cost_original: number
  }[]
}

export interface NewSaleForm {
  customer_name?: string
  currency: Currency
  exchange_rate: number
  notes?: string
  items: {
    product_id: string
    quantity: number
    unit_price: number
  }[]
}

// ============================================================
// DASHBOARD
// ============================================================

export interface DashboardStats {
  today_revenue: number
  today_sales_count: number
  today_profit: number
  today_margin: number
  month_revenue: number
  month_profit: number
  low_stock_count: number
  out_of_stock_count: number
  inventory_value: number
}
