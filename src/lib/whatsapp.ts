import { normalizePhoneBR } from './format'

export interface TemplateVariables {
  nome_cliente?: string
  nome_negocio?: string
  data?: string
  horario?: string
  servico?: string
  profissional?: string
}

export const TEMPLATE_VARIABLES: { key: keyof TemplateVariables; label: string }[] = [
  { key: 'nome_cliente', label: 'Nome do cliente' },
  { key: 'nome_negocio', label: 'Nome do negócio' },
  { key: 'data', label: 'Data' },
  { key: 'horario', label: 'Horário' },
  { key: 'servico', label: 'Serviço' },
  { key: 'profissional', label: 'Profissional' },
]

export function renderTemplate(body: string, variables: TemplateVariables): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) => {
    const value = variables[key as keyof TemplateVariables]
    return value !== undefined && value !== null && value !== '' ? value : match
  })
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalized = normalizePhoneBR(phone)
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export function openWhatsApp(phone: string, message: string): string {
  const url = buildWhatsAppUrl(phone, message)
  window.open(url, '_blank', 'noopener,noreferrer')
  return url
}
