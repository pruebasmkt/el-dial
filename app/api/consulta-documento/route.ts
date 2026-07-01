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
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json({ error: `Error del servicio: ${res.status}` }, { status: res.status })
    }

    const data = await res.json()

    if (isDNI) {
      return NextResponse.json({
        tipo: 'DNI',
        numero: documento,
        nombre: data.nombre_completo ?? data.nombre ?? '',
        apellidos: data.apellido_paterno
          ? `${data.apellido_paterno} ${data.apellido_materno ?? ''}`.trim()
          : '',
      })
    } else {
      return NextResponse.json({
        tipo: 'RUC',
        numero: documento,
        nombre: data.nombre_o_razon_social ?? data.razon_social ?? '',
        direccion: data.direccion ?? '',
        estado: data.estado ?? '',
        condicion: data.condicion ?? '',
      })
    }
  } catch (err) {
    return NextResponse.json({ error: 'No se pudo conectar con apiperu.dev' }, { status: 502 })
  }
}
