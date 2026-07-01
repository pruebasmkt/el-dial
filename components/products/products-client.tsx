"use client"
import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Edit, Package, AlertTriangle, Tag, X, Upload, Download } from 'lucide-react'
import type { Product, Category } from '@/types'

interface Props {
  initialProducts: Product[]
  categories: Category[]
}

const EMPTY_FORM = {
  sku: '', name: '', description: '', category_id: '',
  unit: 'unidad', min_stock: 5,
}

export function ProductsClient({ initialProducts, categories: initialCategories }: Props) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })
  const [categories, setCategories] = useState(initialCategories)
  const [loading, setLoading] = useState(false)
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{ ok: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  function downloadTemplate() {
    const csv = 'sku,name,description,category,unit,min_stock\nHDMI-2M,Cable HDMI 2m,Cable HDMI de alta velocidad,Cables,unidad,5\nUSB-C-1M,Cable USB-C 1m,,Cables,unidad,10'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_productos.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResults(null)
    const text = await file.text()
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = values[i] ?? '' })
      return row
    }).filter(r => r.sku || r.name || r.nombre)

    let ok = 0
    const errors: string[] = []

    for (const row of rows) {
      const sku = (row.sku || '').trim().toUpperCase()
      const name = (row.name || row.nombre || '').trim()
      if (!sku || !name) { errors.push(`Fila sin SKU o nombre`); continue }

      // Buscar category_id por nombre si viene
      let category_id = null
      const catName = (row.category || row.categoria || '').trim()
      if (catName) {
        const found = categories.find(c => c.name.toLowerCase() === catName.toLowerCase())
        if (found) category_id = found.id
      }

      const { error } = await supabase.from('products').upsert({
        sku,
        name,
        description: row.description?.trim() || null,
        category_id,
        unit: row.unit?.trim() || 'unidad',
        min_stock: Number(row.min_stock) || 5,
      }, { onConflict: 'sku' })

      if (error) errors.push(`${sku}: ${error.message}`)
      else ok++
    }

    setImportResults({ ok, errors })
    setImporting(false)
    if (ok > 0) router.refresh()
    e.target.value = ''
  }

  const filtered = useMemo(() =>
    initialProducts.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    ), [initialProducts, search])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      sku: p.sku, name: p.name, description: p.description ?? '',
      category_id: p.category_id ?? '', unit: p.unit,
      min_stock: p.min_stock,
    })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.sku || !form.name) return
    setLoading(true)
    const payload = {
      sku: form.sku.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description || null,
      category_id: form.category_id || null,
      unit: form.unit,
      min_stock: Number(form.min_stock),
    }
    const { error } = editing
      ? await supabase.from('products').update(payload).eq('id', editing.id)
      : await supabase.from('products').insert(payload)

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: editing ? 'Producto actualizado' : 'Producto creado', variant: 'success' })
      setOpen(false)
      router.refresh()
    }
    setLoading(false)
  }

  async function toggleActive(p: Product) {
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id)
    router.refresh()
  }

  async function handleSaveCategory() {
    if (!categoryForm.name.trim()) return
    setCategoryLoading(true)
    const payload = { name: categoryForm.name.trim(), description: categoryForm.description.trim() || null }
    const { data, error } = editingCategory
      ? await supabase.from('categories').update(payload).eq('id', editingCategory.id).select().single()
      : await supabase.from('categories').insert(payload).select().single()
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: editingCategory ? 'Categoría actualizada' : 'Categoría creada', variant: 'success' })
      if (data) setCategories(prev => editingCategory ? prev.map(c => c.id === data.id ? data : c) : [...prev, data])
      setEditingCategory(null)
      setCategoryForm({ name: '', description: '' })
    }
    setCategoryLoading(false)
  }

  async function deleteCategory(id: string) {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' })
    else setCategories(prev => prev.filter(c => c.id !== id))
  }

  return (
    <>
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Buscar por nombre o SKU..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 ml-auto flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1" /> Plantilla CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="h-4 w-4 mr-1" /> {importing ? 'Importando...' : 'Importar CSV'}
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleImport} />
          <Button variant="outline" onClick={() => setCategoryOpen(true)}>
            <Tag className="h-4 w-4 mr-2" /> Categorías
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo Producto
          </Button>
        </div>
      </div>

      {importResults && (
        <div className={`rounded-lg p-3 text-sm ${importResults.errors.length > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
          <p className="font-medium">{importResults.ok} productos importados correctamente</p>
          {importResults.errors.slice(0, 5).map((e, i) => <p key={i} className="text-red-600 text-xs mt-1">{e}</p>)}
        </div>
      )}

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="text-center">Stock Mín.</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-400">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No se encontraron productos
                </TableCell>
              </TableRow>
            ) : filtered.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-sm text-gray-500">{(p as any).categories?.name ?? '—'}</TableCell>
                <TableCell className="text-sm">{p.unit}</TableCell>
                <TableCell className="text-center">
                  <span className={p.current_stock <= p.min_stock ? 'font-bold text-red-600' : ''}>
                    {p.current_stock}
                  </span>
                  {p.current_stock <= p.min_stock && p.current_stock > 0 && (
                    <AlertTriangle className="inline h-3 w-3 text-yellow-500 ml-1" />
                  )}
                </TableCell>
                <TableCell className="text-center text-gray-500">{p.min_stock}</TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant={p.is_active ? 'success' : 'secondary'}
                    className="cursor-pointer"
                    onClick={() => toggleActive(p)}
                  >
                    {p.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>SKU *</Label>
                <Input placeholder="HDMI-2M" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unidad</Label>
                <Input placeholder="unidad" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input placeholder="Cable HDMI 2 metros" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Input placeholder="Descripción opcional" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.id).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Stock Mínimo</Label>
                <Input type="number" min={0} value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={loading || !form.sku || !form.name}>
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog categorías */}
      <Dialog open={categoryOpen} onOpenChange={v => { setCategoryOpen(v); if (!v) { setEditingCategory(null); setCategoryForm({ name: '', description: '' }) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestionar Categorías</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
              <h3 className="text-sm font-semibold">{editingCategory ? 'Editar categoría' : 'Nueva categoría'}</h3>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre *</Label>
                  <Input placeholder="Cables y conectores" value={categoryForm.name} onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descripción</Label>
                  <Input placeholder="Descripción opcional" value={categoryForm.description} onChange={e => setCategoryForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                {editingCategory && (
                  <Button variant="outline" size="sm" onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '' }) }}>
                    <X className="h-3 w-3 mr-1" /> Cancelar
                  </Button>
                )}
                <Button size="sm" onClick={handleSaveCategory} disabled={categoryLoading || !categoryForm.name.trim()}>
                  {categoryLoading ? 'Guardando...' : editingCategory ? 'Actualizar' : 'Agregar'}
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-gray-400">No hay categorías</TableCell>
                  </TableRow>
                ) : categories.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-gray-500">{c.description ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingCategory(c); setCategoryForm({ name: c.name, description: c.description ?? '' }) }}>Editar</Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => deleteCategory(c.id)}>Eliminar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
