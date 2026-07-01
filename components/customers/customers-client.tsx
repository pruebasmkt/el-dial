"use client"
import { useState, useMemo, useRef } from 'react'
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
import { Plus, Search, Edit, Users, Upload, Download } from 'lucide-react'

interface Customer {
  id: string; document_type: string; document_number: string; name: string
  email?: string; phone?: string; address?: string; is_active: boolean; created_at: string
}

const EMPTY_FORM = { document_type: 'DNI', document_number: '', name: '', email: '', phone: '', address: '' }

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row
  }).filter(r => r.name || r.nombre)
}

export function CustomersClient({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{ ok: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const filtered = useMemo(() =>
    initialCustomers.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.document_number.includes(search) ||
      (c.phone ?? '').includes(search)
    ), [initialCustomers, search])

  function openNew() { setEditing(null); setForm(EMPTY_FORM); setOpen(true) }
  function openEdit(c: Customer) {
    setEditing(c)
    setForm({ document_type: c.document_type, document_number: c.document_number, name: c.name, email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '' })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.document_number.trim()) {
      toast({ title: 'Completa nombre y número de documento', variant: 'destructive' })
      return
    }
    setLoading(true)
    const payload = {
      document_type: form.document_type,
      document_number: form.document_number.trim(),
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    }
    const { error } = editing
      ? await supabase.from('customers').update(payload).eq('id', editing.id)
      : await supabase.from('customers').insert(payload)

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: editing ? 'Cliente actualizado' : 'Cliente creado', variant: 'success' })
      setOpen(false)
      router.refresh()
    }
    setLoading(false)
  }

  async function toggleActive(c: Customer) {
    await supabase.from('customers').update({ is_active: !c.is_active }).eq('id', c.id)
    router.refresh()
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResults(null)
    const text = await file.text()
    const rows = parseCSV(text)
    let ok = 0
    const errors: string[] = []

    for (const row of rows) {
      const name = row.name || row.nombre || ''
      const document_number = row.document_number || row.documento || row.dni || row.ruc || ''
      const document_type = (row.document_type || row.tipo || '').toUpperCase() === 'RUC' ? 'RUC' : 'DNI'
      if (!name || !document_number) { errors.push(`Fila sin nombre o documento: ${JSON.stringify(row)}`); continue }
      const { error } = await supabase.from('customers').upsert({
        document_type, document_number: document_number.trim(), name: name.trim(),
        email: row.email?.trim() || null,
        phone: (row.phone || row.telefono)?.trim() || null,
        address: (row.address || row.direccion)?.trim() || null,
      }, { onConflict: 'document_type,document_number' })
      if (error) errors.push(`${name}: ${error.message}`)
      else ok++
    }

    setImportResults({ ok, errors })
    setImporting(false)
    if (ok > 0) router.refresh()
    e.target.value = ''
  }

  function downloadTemplate() {
    const csv = 'document_type,document_number,name,phone,email,address\nDNI,12345678,Juan Pérez,999999999,juan@email.com,Av. Lima 123\nRUC,20123456789,Empresa SAC,01-2345678,ventas@empresa.com,Calle Comercio 456'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_clientes.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Buscar por nombre, DNI/RUC o teléfono..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1" /> Plantilla CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="h-4 w-4 mr-1" /> {importing ? 'Importando...' : 'Importar CSV'}
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleImport} />
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nuevo Cliente</Button>
        </div>
      </div>

      {importResults && (
        <div className={`rounded-lg p-3 text-sm ${importResults.errors.length > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
          <p className="font-medium">{importResults.ok} clientes importados correctamente</p>
          {importResults.errors.slice(0, 5).map((e, i) => <p key={i} className="text-red-600 text-xs mt-1">{e}</p>)}
        </div>
      )}

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Documento</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No se encontraron clientes
                </TableCell>
              </TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-sm">
                  <span className="text-xs text-gray-400 mr-1">{c.document_type}</span>{c.document_number}
                </TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-sm text-gray-600">{c.phone ?? '—'}</TableCell>
                <TableCell className="text-sm text-gray-600">{c.email ?? '—'}</TableCell>
                <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">{c.address ?? '—'}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={c.is_active ? 'success' : 'secondary'} className="cursor-pointer" onClick={() => toggleActive(c)}>
                    {c.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo documento</Label>
                <Select value={form.document_type} onValueChange={v => setForm(f => ({ ...f, document_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DNI">DNI</SelectItem>
                    <SelectItem value="RUC">RUC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>N° Documento *</Label>
                <Input placeholder={form.document_type === 'DNI' ? '12345678' : '20123456789'} value={form.document_number} onChange={e => setForm(f => ({ ...f, document_number: e.target.value }))} maxLength={form.document_type === 'DNI' ? 8 : 11} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nombre / Razón Social *</Label>
              <Input placeholder="Juan Pérez" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input placeholder="999 999 999" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input placeholder="correo@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input placeholder="Av. Lima 123" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={loading || !form.name.trim() || !form.document_number.trim()}>
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
