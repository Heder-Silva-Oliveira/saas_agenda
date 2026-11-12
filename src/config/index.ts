export type DataMode = 'demo' | 'supabase'

export const APP_NAME = 'Controlativa'

export const TRIAL_DAYS = 7
export const TRIAL_ENFORCEMENT = true

export const BOOKING_MIN_NOTICE_MINUTES = 120
export const BOOKING_MAX_DAYS = 60
export const BOOKING_MAX_ACTIVE_PER_PHONE = 3
export const PUBLIC_BOOKING_PATH = '/agendar'

export const PLAN = {
  name: 'Plano Negócio',
  price: 50,
  interval: 'mês',
  description: 'Acesso completo ao Controlativa para um negócio.',
  features: [
    'Clientes e histórico ilimitados',
    'Agenda mensal, semanal e diária',
    'Lembretes e mensagens pelo WhatsApp',
    'Calendário de aniversários',
    'Importação e exportação de clientes',
  ],
}

export const SUPPORT_WHATSAPP = '5511999999999'

const envMode = import.meta.env.VITE_DATA_MODE as DataMode | undefined
const hasSupabaseEnv = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)

export const DATA_MODE: DataMode = envMode ?? (hasSupabaseEnv ? 'supabase' : 'demo')

export const DEMO_CREDENTIALS = {
  email: 'demo@controlativa.com',
  password: 'demo123',
}
