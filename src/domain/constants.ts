import type {
  AppointmentStatus,
  BusinessSegment,
  ClientStatus,
  OpeningHours,
  TemplateCategory,
} from '../types'

export const SEGMENTS: { value: BusinessSegment; label: string }[] = [
  { value: 'barbearia', label: 'Barbearia' },
  { value: 'salao', label: 'Salão de beleza' },
  { value: 'estetica', label: 'Clínica de estética' },
  { value: 'lash', label: 'Lash designer' },
  { value: 'personal', label: 'Personal trainer' },
  { value: 'petshop', label: 'Pet shop' },
  { value: 'outro', label: 'Outro' },
]

export const SEGMENT_LABELS: Record<BusinessSegment, string> = Object.fromEntries(
  SEGMENTS.map((segment) => [segment.value, segment.label]),
) as Record<BusinessSegment, string>

export const WEEKDAYS: { value: string; label: string; short: string }[] = [
  { value: '0', label: 'Domingo', short: 'Dom' },
  { value: '1', label: 'Segunda-feira', short: 'Seg' },
  { value: '2', label: 'Terça-feira', short: 'Ter' },
  { value: '3', label: 'Quarta-feira', short: 'Qua' },
  { value: '4', label: 'Quinta-feira', short: 'Qui' },
  { value: '5', label: 'Sexta-feira', short: 'Sex' },
  { value: '6', label: 'Sábado', short: 'Sáb' },
]

export const DEFAULT_OPENING_HOURS: OpeningHours = {
  '0': { open: '09:00', close: '13:00', closed: true },
  '1': { open: '09:00', close: '18:00', closed: false },
  '2': { open: '09:00', close: '18:00', closed: false },
  '3': { open: '09:00', close: '18:00', closed: false },
  '4': { open: '09:00', close: '18:00', closed: false },
  '5': { open: '09:00', close: '18:00', closed: false },
  '6': { open: '08:00', close: '13:00', closed: false },
}

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  concluido: 'Concluído',
  faltou: 'Faltou',
  cancelado: 'Cancelado',
}

export const APPOINTMENT_STATUS_CLASSES: Record<AppointmentStatus, string> = {
  agendado: 'bg-sky-50 text-sky-700 ring-sky-200',
  confirmado: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  concluido: 'bg-brand-50 text-brand-700 ring-brand-200',
  faltou: 'bg-amber-50 text-amber-700 ring-amber-200',
  cancelado: 'bg-rose-50 text-rose-700 ring-rose-200',
}

export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'agendado',
  'confirmado',
  'concluido',
]

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
}

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  confirmacao: 'Confirmação de agendamento',
  lembrete: 'Lembrete de atendimento',
  aniversario: 'Aniversário',
  retorno: 'Retorno de cliente inativo',
  agradecimento: 'Agradecimento após atendimento',
}

export const TEMPLATE_CATEGORY_DESCRIPTIONS: Record<TemplateCategory, string> = {
  confirmacao: 'Enviada quando o cliente agenda ou confirma um horário.',
  lembrete: 'Enviada na véspera ou no dia do atendimento.',
  aniversario: 'Mensagem de carinho enviada no aniversário do cliente.',
  retorno: 'Convite para clientes sem atendimento há algum tempo.',
  agradecimento: 'Enviada após a conclusão do atendimento.',
}

export interface DefaultTemplate {
  name: string
  category: TemplateCategory
  body: string
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: 'Confirmação de agendamento',
    category: 'confirmacao',
    body: 'Olá {{nome_cliente}}! Seu horário na {{nome_negocio}} está confirmado para {{data}} às {{horario}}. Serviço: {{servico}}. Até lá!',
  },
  {
    name: 'Lembrete de atendimento',
    category: 'lembrete',
    body: 'Oi {{nome_cliente}}! Passando para lembrar do seu atendimento na {{nome_negocio}} em {{data}} às {{horario}}. Podemos confirmar?',
  },
  {
    name: 'Feliz aniversário',
    category: 'aniversario',
    body: 'Feliz aniversário, {{nome_cliente}}! A equipe da {{nome_negocio}} deseja um dia especial. Preparamos um carinho para sua próxima visita.',
  },
  {
    name: 'Sentimos sua falta',
    category: 'retorno',
    body: 'Olá {{nome_cliente}}! Sentimos sua falta na {{nome_negocio}}. Que tal agendar um novo horário? Estamos à disposição.',
  },
  {
    name: 'Agradecimento pela visita',
    category: 'agradecimento',
    body: 'Obrigado pela visita, {{nome_cliente}}! Esperamos que tenha gostado do atendimento na {{nome_negocio}}. Até a próxima!',
  },
]
