import Papa from 'papaparse'
import { formatDateBR, normalizePhoneBR, onlyDigits } from './format'
import type { Client, ClientImportRow } from '../types'

export const CSV_IMPORT_HEADERS = [
  'nome',
  'telefone',
  'email',
  'data_nascimento',
  'observacoes',
  'tags',
  'consentimento',
] as const

export const CSV_TEMPLATE = `${CSV_IMPORT_HEADERS.join(',')}\nMaria Silva,(11) 91234-5678,maria@email.com,15/03/1992,Prefere manhã,cliente vip;cabelo,sim`

function parseDateBR(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return trimmed
  return null
}

function parseConsent(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return ['sim', 's', 'true', '1', 'yes', 'aceito'].includes(normalized)
}

export function parseClientsCsv(
  fileContent: string,
): { rows: ClientImportRow[]; errors: { line: number; message: string }[] } {
  const parsed = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) =>
      header
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_'),
  })

  const rows: ClientImportRow[] = []
  const errors: { line: number; message: string }[] = []

  parsed.data.forEach((raw, index) => {
    const line = index + 2
    const name = (raw.nome ?? raw.name ?? '').trim()
    const phoneRaw = (raw.telefone ?? raw.phone ?? raw.whatsapp ?? '').trim()

    if (!name) {
      errors.push({ line, message: 'Nome é obrigatório.' })
      return
    }
    if (onlyDigits(phoneRaw).length < 10) {
      errors.push({ line, message: 'Telefone inválido. Use DDD + número.' })
      return
    }

    rows.push({
      name,
      phone: normalizePhoneBR(phoneRaw),
      email: (raw.email ?? '').trim() || null,
      birthDate: parseDateBR(raw.data_nascimento ?? raw.nascimento ?? ''),
      notes: (raw.observacoes ?? raw.notes ?? '').trim() || null,
      tags: (raw.tags ?? '')
        .split(/[;,]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      marketingConsent: parseConsent(raw.consentimento ?? raw.consent ?? ''),
    })
  })

  return { rows, errors }
}

export function clientsToCsv(clients: Client[]): string {
  const data = clients.map((client) => ({
    nome: client.name,
    telefone: client.phone,
    email: client.email ?? '',
    data_nascimento: client.birthDate ? formatDateBR(client.birthDate) : '',
    observacoes: client.notes ?? '',
    tags: client.tags.join(';'),
    consentimento: client.marketingConsent ? 'sim' : 'não',
    status: client.status,
  }))

  return `\uFEFF${Papa.unparse(data)}`
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
