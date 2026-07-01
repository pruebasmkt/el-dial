import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: 'PEN' | 'USD' = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export function convertToSoles(amount: number, currency: 'PEN' | 'USD', exchangeRate: number) {
  return currency === 'USD' ? amount * exchangeRate : amount
}

export const STOCK_STATUS_LABELS = {
  ok: 'Normal',
  stock_bajo: 'Stock Bajo',
  sin_stock: 'Sin Stock',
} as const

export const STOCK_STATUS_COLORS = {
  ok: 'text-green-600 bg-green-50',
  stock_bajo: 'text-yellow-600 bg-yellow-50',
  sin_stock: 'text-red-600 bg-red-50',
} as const

export const PO_STATUS_LABELS = {
  draft: 'Pendiente',
  confirmed: 'Pendiente',
  received: 'Recibida',
  cancelled: 'Cancelada',
} as const

export const PO_STATUS_COLORS = {
  draft: 'text-orange-700 bg-orange-100 border-orange-200',
  confirmed: 'text-orange-700 bg-orange-100 border-orange-200',
  received: 'text-green-700 bg-green-100 border-green-200',
  cancelled: 'text-red-700 bg-red-100 border-red-200',
} as const

export const SALE_STATUS_LABELS = {
  completed: 'Completada',
  cancelled: 'Cancelada',
  returned: 'Devuelta',
} as const
