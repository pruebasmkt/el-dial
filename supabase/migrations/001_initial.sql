-- ============================================================
-- EL DIAL - Sistema de Gestión de Tienda Electrónica
-- Migración inicial con FIFO implementado en PostgreSQL
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CATEGORÍAS DE PRODUCTOS
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTOS
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id),
  unit TEXT NOT NULL DEFAULT 'unidad',
  min_stock INTEGER NOT NULL DEFAULT 5,
  current_stock INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);

-- ============================================================
-- PROVEEDORES
-- ============================================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÓRDENES DE COMPRA
-- ============================================================
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES suppliers(id),
  supplier_name TEXT NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  currency TEXT NOT NULL DEFAULT 'PEN' CHECK (currency IN ('PEN', 'USD')),
  exchange_rate NUMERIC(10,4) NOT NULL DEFAULT 1.0,
  subtotal_original NUMERIC(14,4) NOT NULL DEFAULT 0,
  subtotal_pen NUMERIC(14,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','received','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_po_date ON purchase_orders(order_date);
CREATE INDEX idx_po_status ON purchase_orders(status);

-- ============================================================
-- ITEMS DE ORDEN DE COMPRA
-- ============================================================
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost_original NUMERIC(14,4) NOT NULL,
  unit_cost_pen NUMERIC(14,4) NOT NULL,
  total_cost_pen NUMERIC(14,4) GENERATED ALWAYS AS (quantity * unit_cost_pen) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_poi_order ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_poi_product ON purchase_order_items(product_id);

-- ============================================================
-- LOTES DE INVENTARIO (base del FIFO)
-- Cada item de compra recibida genera un lote
-- ============================================================
CREATE TABLE inventory_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  purchase_order_item_id UUID REFERENCES purchase_order_items(id),
  quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
  quantity_remaining INTEGER NOT NULL CHECK (quantity_remaining >= 0),
  unit_cost_pen NUMERIC(14,4) NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lots_product ON inventory_lots(product_id);
CREATE INDEX idx_lots_remaining ON inventory_lots(product_id, quantity_remaining) WHERE quantity_remaining > 0;
CREATE INDEX idx_lots_received ON inventory_lots(product_id, received_at);

-- ============================================================
-- VENTAS
-- ============================================================
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_number TEXT NOT NULL UNIQUE,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_name TEXT,
  currency TEXT NOT NULL DEFAULT 'PEN' CHECK (currency IN ('PEN', 'USD')),
  exchange_rate NUMERIC(10,4) NOT NULL DEFAULT 1.0,
  subtotal NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_cost_pen NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_profit_pen NUMERIC(14,4) GENERATED ALWAYS AS (subtotal - total_cost_pen) STORED,
  profit_margin NUMERIC(6,4) GENERATED ALWAYS AS (
    CASE WHEN subtotal > 0 THEN (subtotal - total_cost_pen) / subtotal ELSE 0 END
  ) STORED,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','cancelled','returned')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_status ON sales(status);

-- ============================================================
-- ITEMS DE VENTA
-- ============================================================
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_pen NUMERIC(14,4) NOT NULL,
  total_price_pen NUMERIC(14,4) GENERATED ALWAYS AS (quantity * unit_price_pen) STORED,
  unit_cost_pen NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_cost_pen NUMERIC(14,4) GENERATED ALWAYS AS (quantity * unit_cost_pen) STORED,
  profit_pen NUMERIC(14,4) GENERATED ALWAYS AS ((quantity * unit_price_pen) - (quantity * unit_cost_pen)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_si_sale ON sale_items(sale_id);
CREATE INDEX idx_si_product ON sale_items(product_id);

-- ============================================================
-- DETALLE DE LOTES CONSUMIDOS POR VENTA (trazabilidad FIFO)
-- ============================================================
CREATE TABLE sale_item_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  inventory_lot_id UUID NOT NULL REFERENCES inventory_lots(id),
  quantity_used INTEGER NOT NULL CHECK (quantity_used > 0),
  unit_cost_pen NUMERIC(14,4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sil_sale_item ON sale_item_lots(sale_item_id);
CREATE INDEX idx_sil_lot ON sale_item_lots(inventory_lot_id);

-- ============================================================
-- FUNCIÓN FIFO: Procesar una venta y descontar lotes
-- Retorna el costo promedio ponderado del ítem vendido
-- ============================================================
CREATE OR REPLACE FUNCTION process_sale_item_fifo(
  p_sale_item_id UUID,
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS NUMERIC AS $$
DECLARE
  v_lot RECORD;
  v_remaining INTEGER := p_quantity;
  v_qty_from_lot INTEGER;
  v_total_cost NUMERIC := 0;
BEGIN
  -- Iterar lotes en orden FIFO (más antiguo primero)
  FOR v_lot IN
    SELECT id, quantity_remaining, unit_cost_pen
    FROM inventory_lots
    WHERE product_id = p_product_id
      AND quantity_remaining > 0
    ORDER BY received_at ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_qty_from_lot := LEAST(v_remaining, v_lot.quantity_remaining);

    -- Registrar consumo del lote
    INSERT INTO sale_item_lots (sale_item_id, inventory_lot_id, quantity_used, unit_cost_pen)
    VALUES (p_sale_item_id, v_lot.id, v_qty_from_lot, v_lot.unit_cost_pen);

    -- Descontar del lote
    UPDATE inventory_lots
    SET quantity_remaining = quantity_remaining - v_qty_from_lot
    WHERE id = v_lot.id;

    v_total_cost := v_total_cost + (v_qty_from_lot * v_lot.unit_cost_pen);
    v_remaining := v_remaining - v_qty_from_lot;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Stock insuficiente para producto %: faltan % unidades', p_product_id, v_remaining;
  END IF;

  -- Retorna costo unitario promedio ponderado
  RETURN v_total_cost / p_quantity;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCIÓN: Registrar recepción de compra y crear lotes
-- ============================================================
CREATE OR REPLACE FUNCTION receive_purchase_order(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Verificar que la orden esté confirmada
  IF NOT EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE id = p_order_id AND status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'La orden debe estar en estado "confirmed" para ser recibida';
  END IF;

  -- Crear lote para cada item
  FOR v_item IN
    SELECT id, product_id, quantity, unit_cost_pen
    FROM purchase_order_items
    WHERE purchase_order_id = p_order_id
  LOOP
    INSERT INTO inventory_lots (
      product_id, purchase_order_item_id,
      quantity_received, quantity_remaining, unit_cost_pen
    ) VALUES (
      v_item.product_id, v_item.id,
      v_item.quantity, v_item.quantity, v_item.unit_cost_pen
    );

    -- Actualizar stock del producto
    UPDATE products
    SET current_stock = current_stock + v_item.quantity,
        updated_at = NOW()
    WHERE id = v_item.product_id;
  END LOOP;

  -- Marcar orden como recibida
  UPDATE purchase_orders
  SET status = 'received', updated_at = NOW()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER: Actualizar stock al modificar lotes
-- ============================================================
CREATE OR REPLACE FUNCTION sync_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET current_stock = (
    SELECT COALESCE(SUM(quantity_remaining), 0)
    FROM inventory_lots
    WHERE product_id = NEW.product_id
  ),
  updated_at = NOW()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_stock_after_lot_update
AFTER UPDATE ON inventory_lots
FOR EACH ROW
WHEN (OLD.quantity_remaining IS DISTINCT FROM NEW.quantity_remaining)
EXECUTE FUNCTION sync_product_stock();

-- ============================================================
-- SECUENCIAS PARA NUMERACIÓN AUTOMÁTICA
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS po_number_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS sale_number_seq START 1000;

CREATE OR REPLACE FUNCTION next_po_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'OC-' || LPAD(nextval('po_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION next_sale_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'VT-' || LPAD(nextval('sale_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VISTA: INVENTARIO CON ALERTAS DE STOCK
-- ============================================================
CREATE OR REPLACE VIEW v_inventory_status AS
SELECT
  p.id,
  p.sku,
  p.name,
  p.unit,
  p.current_stock,
  p.min_stock,
  p.is_active,
  c.name AS category_name,
  CASE
    WHEN p.current_stock = 0 THEN 'sin_stock'
    WHEN p.current_stock <= p.min_stock THEN 'stock_bajo'
    ELSE 'ok'
  END AS stock_status,
  COALESCE((
    SELECT AVG(unit_cost_pen)
    FROM inventory_lots
    WHERE product_id = p.id AND quantity_remaining > 0
  ), 0) AS avg_cost_pen,
  COALESCE((
    SELECT SUM(quantity_remaining * unit_cost_pen)
    FROM inventory_lots
    WHERE product_id = p.id AND quantity_remaining > 0
  ), 0) AS inventory_value_pen
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.is_active = TRUE;

-- ============================================================
-- VISTA: DASHBOARD - RESUMEN DE VENTAS
-- ============================================================
CREATE OR REPLACE VIEW v_sales_summary AS
SELECT
  DATE_TRUNC('day', sale_date) AS day,
  COUNT(*) AS total_sales,
  SUM(subtotal) AS total_revenue_pen,
  SUM(total_cost_pen) AS total_cost_pen,
  SUM(total_profit_pen) AS total_profit_pen,
  AVG(profit_margin) AS avg_margin
FROM sales
WHERE status = 'completed'
GROUP BY DATE_TRUNC('day', sale_date)
ORDER BY day DESC;

-- ============================================================
-- VISTA: TOP PRODUCTOS VENDIDOS
-- ============================================================
CREATE OR REPLACE VIEW v_top_products AS
SELECT
  p.id,
  p.name,
  p.sku,
  SUM(si.quantity) AS total_qty_sold,
  SUM(si.total_price_pen) AS total_revenue_pen,
  SUM(si.total_cost_pen) AS total_cost_pen,
  SUM(si.profit_pen) AS total_profit_pen
FROM sale_items si
JOIN products p ON si.product_id = p.id
JOIN sales s ON si.sale_id = s.id
WHERE s.status = 'completed'
GROUP BY p.id, p.name, p.sku
ORDER BY total_revenue_pen DESC;

-- ============================================================
-- DATOS INICIALES
-- ============================================================
INSERT INTO categories (name, description) VALUES
  ('Cables y Conectores', 'HDMI, USB, RCA, coaxial y adaptadores'),
  ('Audio', 'Parlantes, audífonos, amplificadores'),
  ('Video', 'Monitores, proyectores, accesorios'),
  ('Baterías y Pilas', 'Baterías recargables y alcalinas'),
  ('Herramientas', 'Multímetros, soldadores, pinzas'),
  ('Iluminación', 'LED, lámparas, tiras de luz'),
  ('Redes', 'Routers, switches, cables de red'),
  ('Accesorios', 'Control remoto, soportes, limpiadores');

INSERT INTO suppliers (name, contact_name, phone, email) VALUES
  ('Distribuidora Tech Peru', 'Carlos Mendoza', '01-234-5678', 'ventas@techperu.com'),
  ('Importaciones El Sol', 'Maria García', '01-345-6789', 'pedidos@elsol.pe'),
  ('Electro Mayoristas Lima', 'José Torres', '01-456-7890', 'compras@electromayoristas.pe');

-- RLS (Row Level Security) - activar en producción
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_item_lots ENABLE ROW LEVEL SECURITY;

-- Políticas: solo usuarios autenticados pueden leer y escribir
CREATE POLICY "authenticated_all" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON inventory_lots FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON sale_item_lots FOR ALL TO authenticated USING (true) WITH CHECK (true);
