import { format, isValid, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function normalizePhoneBR(value: string): string {
  const digits = onlyDigits(value)
  if (!digits) return ''
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}

export function formatPhoneBR(value: string): string {
  const digits = onlyDigits(value)
  const national =
    digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits
  if (national.length === 11) {
    return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`
  }
  if (national.length === 10) {
    return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`
  }
  return value
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0)
}

export function parseCurrencyBR(value: string): number {
  if (!value) return 0
  const normalized = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return isValid(value) ? value : null
  const parsed = value.length <= 10 ? new Date(`${value}T00:00:00`) : parseISO(value)
  return isValid(parsed) ? parsed : null
}

export function formatDateBR(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : '—'
}

export function formatDateLong(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, "EEEE, d 'de' MMMM", { locale: ptBR }) : '—'
}

export function formatDateShort(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, "d 'de' MMM", { locale: ptBR }) : '—'
}

export function formatWeekday(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, 'EEEE', { locale: ptBR }) : '—'
}

export function formatDateTimeBR(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'
}

export function formatTime(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, 'HH:mm') : '—'
}

export function toDateKey(value: string | Date): string {
  const date = toDate(value)
  return date ? format(date, 'yyyy-MM-dd') : ''
}

export function toMonthKey(value: string | Date): string {
  const date = toDate(value)
  return date ? format(date, 'yyyy-MM') : ''
}

export function combineDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`)
}

export function addMinutesToISO(iso: string, minutes: number): string {
  const date = parseISO(iso)
  return new Date(date.getTime() + minutes * 60_000).toISOString()
}

export function ageFromBirthDate(birthDate: string | null | undefined, reference = new Date()): number | null {
  const date = toDate(birthDate)
  if (!date) return null
  let age = reference.getFullYear() - date.getFullYear()
  const monthDiff = reference.getMonth() - date.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < date.getDate())) {
    age -= 1
  }
  return age >= 0 ? age : null
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function truncate(value: string, length = 120): string {
  if (value.length <= length) return value
  return `${value.slice(0, length).trimEnd()}…`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`
}
