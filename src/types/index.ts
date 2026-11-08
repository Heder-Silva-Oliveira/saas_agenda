export type UUID = string

export type BusinessSegment =
  | 'barbearia'
  | 'salao'
  | 'estetica'
  | 'lash'
  | 'personal'
  | 'petshop'
  | 'outro'

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled'

export type ClientStatus = 'ativo' | 'inativo'

export type AppointmentStatus =
  | 'agendado'
  | 'confirmado'
  | 'concluido'
  | 'faltou'
  | 'cancelado'

export type TemplateCategory =
  | 'confirmacao'
  | 'lembrete'
  | 'aniversario'
  | 'retorno'
  | 'agradecimento'

export type MessageChannel = 'whatsapp'

export type MessageStatus = 'manual' | 'enviado' | 'falhou'

export type ProfileRole = 'owner' | 'staff'

export type AppointmentSource = 'internal' | 'public'

export interface DayHours {
  open: string
  close: string
  closed: boolean
}

export type OpeningHours = Record<string, DayHours>

export interface Business {
  id: UUID
  ownerUserId: UUID
  name: string
  slug: string
  segment: BusinessSegment
  whatsappNumber: string
  openingHours: OpeningHours
  logoUrl: string | null
  timezone: string
  publicBookingEnabled: boolean
  plan: string
  subscriptionStatus: SubscriptionStatus
  trialEndsAt: string
  onboardingCompleted: boolean
  accessRequestedAt: string | null
  accessRequestNote: string | null
  createdAt: string
}

export interface Profile {
  id: UUID
  userId: UUID
  businessId: UUID
  fullName: string
  role: ProfileRole
  createdAt: string
}

export interface Client {
  id: UUID
  businessId: UUID
  name: string
  phone: string
  email: string | null
  birthDate: string | null
  notes: string | null
  tags: string[]
  status: ClientStatus
  marketingConsent: boolean
  consentDate: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Service {
  id: UUID
  businessId: UUID
  name: string
  durationMinutes: number
  price: number
  active: boolean
}

export interface Professional {
  id: UUID
  businessId: UUID
  name: string
  active: boolean
  createdAt: string
}

export interface ProfessionalInput {
  name: string
  active: boolean
}

export interface Appointment {
  id: UUID
  businessId: UUID
  clientId: UUID
  serviceId: UUID | null
  professionalName: string | null
  startsAt: string
  endsAt: string
  price: number
  status: AppointmentStatus
  notes: string | null
  source: AppointmentSource
  cancelToken?: string | null
  createdAt: string
  updatedAt: string
}

export interface MessageTemplate {
  id: UUID
  businessId: UUID
  name: string
  category: TemplateCategory
  body: string
  active: boolean
}

export interface MessageLog {
  id: UUID
  businessId: UUID
  clientId: UUID
  appointmentId: UUID | null
  templateId: UUID | null
  channel: MessageChannel
  messageContent: string
  status: MessageStatus
  sentAt: string
}

export interface SessionUser {
  id: UUID
  email: string
  fullName: string
}

export interface SignUpInput {
  fullName: string
  email: string
  password: string
  businessName: string
}

export interface SignUpResult {
  session: SessionUser | null
  needsEmailConfirmation: boolean
}

export interface ClientInput {
  name: string
  phone: string
  email?: string | null
  birthDate?: string | null
  notes?: string | null
  tags?: string[]
  status: ClientStatus
  marketingConsent: boolean
  consentDate?: string | null
}

export interface ClientImportRow {
  name: string
  phone: string
  email?: string | null
  birthDate?: string | null
  notes?: string | null
  tags?: string[]
  marketingConsent: boolean
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: { line: number; message: string }[]
}

export interface ServiceInput {
  name: string
  durationMinutes: number
  price: number
  active: boolean
}

export interface AppointmentInput {
  clientId: string
  serviceId: string | null
  professionalName?: string | null
  date: string
  startTime: string
  durationMinutes: number
  price: number
  status: AppointmentStatus
  notes?: string | null
}

export interface BusinessInput {
  name: string
  slug?: string
  segment: BusinessSegment
  whatsappNumber: string
  openingHours: OpeningHours
  logoUrl: string | null
  publicBookingEnabled?: boolean
  onboardingCompleted?: boolean
}

export interface AccessRequestInput {
  name: string
  email: string
  phone: string
  note?: string
}

export interface AppointmentWithClient extends Appointment {
  client?: Client
  service?: Service
}

export interface PublicBusiness {
  id: UUID
  slug: string
  name: string
  segment: BusinessSegment
  whatsappNumber: string
  logoUrl: string | null
  openingHours: OpeningHours
  timezone: string
}

export interface PublicService {
  id: UUID
  name: string
  durationMinutes: number
  price: number
}

export interface PublicProfessional {
  id: UUID
  name: string
}

export interface PublicBusinessInfo {
  business: PublicBusiness
  services: PublicService[]
  professionals: PublicProfessional[]
}

export interface PublicSlot {
  startsAt: string
  time: string
}

export interface PublicBookingInput {
  slug: string
  serviceId: string
  professionalId?: string | null
  startsAt: string
  name: string
  phone: string
  email?: string | null
  notes?: string | null
  marketingConsent: boolean
  honeypot?: string
}

export interface PublicBookingResult {
  id: UUID
  cancelToken: UUID
  startsAt: string
  endsAt: string
  professionalName: string | null
  serviceName: string
  price: number
  status: AppointmentStatus
}

export interface PublicAppointment {
  id: UUID
  businessName: string
  businessSlug: string
  businessWhatsapp: string
  serviceName: string | null
  professionalName: string | null
  startsAt: string
  endsAt: string
  price: number
  status: AppointmentStatus
  clientName: string
  canCancel: boolean
}

export interface DashboardData {
  activeClients: number
  todayAppointments: AppointmentWithClient[]
  weekAppointments: AppointmentWithClient[]
  todayBirthdays: Client[]
  monthBirthdays: Client[]
  inactive: {
    days30: Client[]
    days60: Client[]
    days90: Client[]
  }
  monthStats: {
    concluidos: number
    faltas: number
    cancelados: number
    agendados: number
  }
  trialDaysLeft: number
}
