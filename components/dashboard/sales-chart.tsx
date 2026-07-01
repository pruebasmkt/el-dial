"use client"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { SalesSummary } from '@/types'

export function SalesChart({ data }: { data: SalesSummary[] }) {
  const chartData = [...data].reverse().map(d => ({
    date: format(new Date(d.day), 'dd MMM', { locale: es }),
    ventas: Number(d.total_revenue_pen),
    utilidad: Number(d.total_profit_pen),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="ventas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="utilidad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `S/${(v/1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(value: number, name: string) => [
            `S/ ${value.toFixed(2)}`,
            name === 'ventas' ? 'Ventas' : 'Utilidad',
          ]}
        />
        <Area type="monotone" dataKey="ventas" stroke="#3b82f6" fill="url(#ventas)" strokeWidth={2} />
        <Area type="monotone" dataKey="utilidad" stroke="#10b981" fill="url(#utilidad)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
