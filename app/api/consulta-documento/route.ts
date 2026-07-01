import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const documento = searchParams.get('documento')?.trim()

  if (!documento) return NextResponse.json({ error: 'Documento requerido' }, { status: 400 })

  const token = process.env.APIPERU_TOKEN
  if (!token) return NextResponse.json({ error: 'Token APIPERU_TOKEN no configurado' }, { status: 500 })

  const isDNI = documento.length === 8
  const isRUC = documento.length === 11

  if (!isDNI && !isRUC) {
    return NextResponse.json({ error: 'DNI debe tener 8 dígitos, RUC 11 dígitos' }, { status: 400 })
  }

  const url = isDNI
    ? `https://apiperu.dev/api/dni/${documento}`
    : `https://apiperu.dev/api/ruc/${documento}`

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    const json = await res.json()

    // apiperu.dev devuelve { success: true, data: { ... } }
    const d = json?.data ?? json

    if (!res.ok || json?.success === false) {
      return NextResponse.json({ error: json?.message ?? `No se encontró el ${isDNI ? 'DNI' : 'RUC'}` }, { status: 404 })
    }

    if (isDNI) {
      const nombre = d.nombre_completo
        ?? (d.nombres && d.apellido_paterno ? `${d.apellido_paterno} ${d.apellido_materno ?? ''} ${d.nombres}`.trim() : '')
        ?? d.nombre
        ?? ''
      return NextResponse.json({ tipo: 'DNI', numero: documento, nombre, apellidos: '' })
    } else {
      const nombre = d.nombre_o_razon_social ?? d.razon_social ?? d.nombre ?? ''
      const direccion = d.direccion ?? d.direccion_completa ?? ''
      return NextResponse.json({ tipo: 'RUC', numero: documento, nombre, direccion })
    }
  } catch (err) {
    return NextResponse.json({ error: 'No se pudo conectar con apiperu.dev' }, { status: 502 })
  }
}
