import { addDays, format } from 'date-fns'
import type {
  AccessRequestInput,
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  Business,
  BusinessInput,
  Client,
  ClientImportRow,
  ClientInput,
  MessageLog,
  MessageTemplate,
  Professional,
  ProfessionalInput,
  PublicAppointment,
  PublicBookingInput,
  PublicBookingResult,
  PublicBusinessInfo,
  PublicSlot,
  Service,
  ServiceInput,
  SessionUser,
  SignUpInput,
  SignUpResult,
  TemplateCategory,
} from '../types'
import type { Api } from './types'
import {
  BOOKING_MAX_ACTIVE_PER_PHONE,
  BOOKING_MAX_DAYS,
  BOOKING_MIN_NOTICE_MINUTES,
  TRIAL_DAYS,
} from '../config'
import {
  ACTIVE_APPOINTMENT_STATUSES,
  DEFAULT_OPENING_HOURS,
  DEFAULT_TEMPLATES,
} from '../domain/constants'
import {
  buildDashboard,
  getPublicSlots,
  hasConflict,
  isTrialActive,
} from '../domain/rules'
import { combineDateTime, normalizePhoneBR, onlyDigits, toDateKey } from '../lib/format'

const DB_KEY = 'controlativa:db:v1'
const SESSION_KEY = 'controlativa:session:v1'

interface DemoUser {
  id: string
  email: string
  password: string
  fullName: string
  businessId: string
}

interface DemoDb {
  users: DemoUser[]
  businesses: Business[]
  clients: Client[]
  services: Service[]
  professionals: Professional[]
  appointments: Appointment[]
  templates: MessageTemplate[]
  logs: MessageLog[]
  accessRequests: (AccessRequestInput & { id: string; businessId: string; createdAt: string })[]
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

const nowISO = (): string => new Date().toISOString()

function at(offsetDays: number, time: string): string {
  const date = addDays(new Date(), offsetDays)
  const [hours, minutes] = time.split(':').map(Number)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

function endAt(startISO: string, minutes: number): string {
  return new Date(new Date(startISO).getTime() + minutes * 60_000).toISOString()
}

function birthday(offsetDays: number, age: number): string {
  const date = addDays(new Date(), offsetDays)
  return `${date.getFullYear() - age}-${format(date, 'MM-dd')}`
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function uniqueSlug(db: DemoDb, name: string, ignoreId?: string): string {
  const base = slugify(name) || 'negocio'
  let candidate = base
  let counter = 1
  while (
    db.businesses.some(
      (business) => business.slug === candidate && business.id !== ignoreId,
    )
  ) {
    counter += 1
    candidate = `${base}-${counter}`
  }
  return candidate
}

function findPublicBusiness(db: DemoDb, slug: string): Business | null {
  const business = db.businesses.find((item) => item.slug === slug)
  if (!business) return null
  if (!business.publicBookingEnabled || !business.onboardingCompleted) return null
  if (!isTrialActive(business)) return null
  return business
}

function readDb(): DemoDb | null {
  try {
    const raw = localStorage.getItem(DB_KEY)
    return raw ? (JSON.parse(raw) as DemoDb) : null
  } catch {
    return null
  }
}

function writeDb(db: DemoDb): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

function getSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

function requireUser(db: DemoDb): DemoUser {
  const userId = getSessionUserId()
  const user = db.users.find((item) => item.id === userId)
  if (!user) throw new Error('Sessão expirada. Faça login novamente.')
  return user
}

function seedDb(): DemoDb {
  const businessId = 'demo-business'
  const userId = 'demo-user'

  const business: Business = {
    id: businessId,
    ownerUserId: userId,
    name: 'Barbearia Corte Nobre',
    slug: 'barbearia-corte-nobre',
    segment: 'barbearia',
    segmentCustom: null,
    whatsappNumber: '5511987654321',
    openingHours: DEFAULT_OPENING_HOURS,
    logoUrl: null,
    timezone: 'America/Sao_Paulo',
    publicBookingEnabled: true,
    plan: 'Plano Negócio',
    subscriptionStatus: 'trial',
    trialEndsAt: addDays(new Date(), TRIAL_DAYS).toISOString(),
    onboardingCompleted: true,
    accessRequestedAt: null,
    accessRequestNote: null,
    createdAt: addDays(new Date(), -120).toISOString(),
  }

  const professionals: Professional[] = [
    {
      id: 'pro-rafael',
      businessId,
      name: 'Rafael',
      active: true,
      createdAt: addDays(new Date(), -120).toISOString(),
    },
    {
      id: 'pro-bianca',
      businessId,
      name: 'Bianca',
      active: true,
      createdAt: addDays(new Date(), -90).toISOString(),
    },
  ]

  const services: Service[] = [
    { id: 'svc-corte', businessId, name: 'Corte masculino', durationMinutes: 45, price: 60, active: true },
    { id: 'svc-barba', businessId, name: 'Barba', durationMinutes: 30, price: 45, active: true },
    { id: 'svc-combo', businessId, name: 'Corte + barba', durationMinutes: 60, price: 90, active: true },
    { id: 'svc-pigmentacao', businessId, name: 'Pigmentação', durationMinutes: 40, price: 70, active: true },
    { id: 'svc-sobrancelha', businessId, name: 'Design de sobrancelha', durationMinutes: 30, price: 50, active: true },
  ]

  const clientSeed: Array<Partial<Client> & { id: string; name: string; phone: string }> = [
    { id: 'cli-1', name: 'Ana Beatriz Souza', phone: '5511991110001', birthDate: birthday(0, 32), marketingConsent: true, tags: ['vip', 'cabelo'], notes: 'Prefere atendimento pela manhã.' },
    { id: 'cli-2', name: 'Carlos Eduardo Lima', phone: '5511991110002', birthDate: birthday(0, 28), marketingConsent: true, tags: ['recorrente'] },
    { id: 'cli-3', name: 'Mariana Ferreira', phone: '5511991110003', birthDate: birthday(3, 25), marketingConsent: true, tags: ['sobrancelha'] },
    { id: 'cli-4', name: 'João Pedro Alves', phone: '5511991110004', birthDate: birthday(10, 35), marketingConsent: false, tags: ['barba'] },
    { id: 'cli-5', name: 'Fernanda Costa', phone: '5511991110005', birthDate: birthday(12, 29), marketingConsent: true, tags: ['retorno'] },
    { id: 'cli-6', name: 'Ricardo Santos', phone: '5511991110006', birthDate: '1988-02-14', marketingConsent: true, tags: [] },
    { id: 'cli-7', name: 'Juliana Martins', phone: '5511991110007', birthDate: '1995-07-09', marketingConsent: false, tags: [] },
    { id: 'cli-8', name: 'Bruno Oliveira', phone: '5511991110008', birthDate: '1992-11-23', marketingConsent: true, tags: ['recorrente'] },
    { id: 'cli-9', name: 'Camila Rocha', phone: '5511991110009', birthDate: '1997-04-02', marketingConsent: true, tags: [] },
    { id: 'cli-10', name: 'Diego Nunes', phone: '5511991110010', birthDate: '1990-09-17', marketingConsent: true, tags: ['vip'] },
    { id: 'cli-11', name: 'Larissa Mendes', phone: '5511991110011', birthDate: '1993-06-30', marketingConsent: true, tags: [] },
    { id: 'cli-12', name: 'Paulo Henrique', phone: '5511991110012', birthDate: '1985-01-12', marketingConsent: true, tags: [] },
    { id: 'cli-13', name: 'Renata Dias', phone: '5511991110013', birthDate: '1999-08-21', marketingConsent: true, tags: ['pigmentação'] },
    { id: 'cli-14', name: 'Thiago Barbosa', phone: '5511991110014', birthDate: '1991-03-05', marketingConsent: false, tags: [] },
    { id: 'cli-15', name: 'Vanessa Ribeiro', phone: '5511991110015', birthDate: '1994-12-08', marketingConsent: true, status: 'inativo', tags: [] },
    { id: 'cli-16', name: 'Lucas Pereira', phone: '5511991110016', birthDate: '2000-10-14', marketingConsent: true, tags: ['novo'] },
  ]

  const clients: Client[] = clientSeed.map((item, index) => {
    const createdAt = at(-150 + index * 5, '10:00')
    return {
      id: item.id,
      businessId,
      name: item.name,
      phone: item.phone,
      email: `${item.name.split(' ')[0].toLowerCase()}@email.com`,
      birthDate: item.birthDate ?? null,
      notes: item.notes ?? null,
      tags: item.tags ?? [],
      status: item.status ?? 'ativo',
      marketingConsent: item.marketingConsent ?? false,
      consentDate: item.marketingConsent ? at(-60, '09:00') : null,
      deletedAt: null,
      createdAt: item.id === 'cli-16' ? at(-40, '10:00') : createdAt,
      updatedAt: createdAt,
    }
  })

  const makeAppointment = (
    id: string,
    clientId: string,
    serviceId: string,
    professional: string,
    startISO: string,
    status: AppointmentStatus,
    notes?: string,
  ): Appointment => {
    const service = services.find((item) => item.id === serviceId)!
    return {
      id,
      businessId,
      clientId,
      serviceId,
      professionalName: professional,
      startsAt: startISO,
      endsAt: endAt(startISO, service.durationMinutes),
      price: service.price,
      status,
      notes: notes ?? null,
      source: 'internal',
      cancelToken: null,
      createdAt: startISO,
      updatedAt: startISO,
    }
  }

  const appointments: Appointment[] = [
    makeAppointment('apt-t1', 'cli-1', 'svc-combo', 'Rafael', at(0, '09:30'), 'confirmado'),
    makeAppointment('apt-t2', 'cli-8', 'svc-corte', 'Rafael', at(0, '14:00'), 'agendado'),
    makeAppointment('apt-t3', 'cli-9', 'svc-sobrancelha', 'Bianca', at(0, '16:30'), 'agendado'),
    makeAppointment('apt-t4', 'cli-3', 'svc-barba', 'Rafael', at(1, '10:00'), 'agendado'),
    makeAppointment('apt-t5', 'cli-10', 'svc-combo', 'Rafael', at(1, '15:00'), 'confirmado'),
    makeAppointment('apt-t6', 'cli-11', 'svc-pigmentacao', 'Bianca', at(2, '11:00'), 'agendado'),
    makeAppointment('apt-t7', 'cli-12', 'svc-corte', 'Rafael', at(2, '16:00'), 'agendado'),
    makeAppointment('apt-t8', 'cli-13', 'svc-combo', 'Rafael', at(3, '09:00'), 'agendado'),
    makeAppointment('apt-t9', 'cli-14', 'svc-barba', 'Rafael', at(3, '14:30'), 'cancelado'),
    makeAppointment('apt-t10', 'cli-1', 'svc-corte', 'Rafael', at(5, '10:00'), 'agendado'),
    makeAppointment('apt-t11', 'cli-6', 'svc-corte', 'Rafael', at(-2, '11:00'), 'faltou'),
    makeAppointment('apt-t12', 'cli-2', 'svc-combo', 'Rafael', at(6, '15:00'), 'agendado'),
    makeAppointment('apt-h1', 'cli-1', 'svc-combo', 'Rafael', at(-20, '10:00'), 'concluido'),
    makeAppointment('apt-h2', 'cli-2', 'svc-corte', 'Rafael', at(-18, '11:00'), 'concluido'),
    makeAppointment('apt-h3', 'cli-3', 'svc-barba', 'Rafael', at(-12, '09:00'), 'concluido'),
    makeAppointment('apt-h4', 'cli-4', 'svc-corte', 'Rafael', at(-25, '16:00'), 'concluido'),
    makeAppointment('apt-h5', 'cli-5', 'svc-corte', 'Rafael', at(-45, '10:00'), 'concluido'),
    makeAppointment('apt-h6', 'cli-6', 'svc-combo', 'Rafael', at(-75, '15:00'), 'concluido'),
    makeAppointment('apt-h7', 'cli-7', 'svc-barba', 'Rafael', at(-100, '11:00'), 'concluido'),
    makeAppointment('apt-h8', 'cli-8', 'svc-corte', 'Rafael', at(-7, '14:00'), 'concluido'),
    makeAppointment('apt-h9', 'cli-9', 'svc-sobrancelha', 'Bianca', at(-5, '16:00'), 'concluido'),
    makeAppointment('apt-h10', 'cli-10', 'svc-combo', 'Rafael', at(-15, '09:00'), 'concluido'),
    makeAppointment('apt-h11', 'cli-11', 'svc-corte', 'Rafael', at(-9, '10:00'), 'concluido'),
    makeAppointment('apt-h12', 'cli-12', 'svc-barba', 'Rafael', at(-22, '17:00'), 'concluido'),
    makeAppointment('apt-h13', 'cli-13', 'svc-pigmentacao', 'Bianca', at(-3, '13:00'), 'concluido'),
    makeAppointment('apt-h14', 'cli-14', 'svc-corte', 'Rafael', at(-30, '11:00'), 'concluido'),
    makeAppointment('apt-h15', 'cli-15', 'svc-corte', 'Rafael', at(-60, '15:00'), 'concluido'),
    makeAppointment('apt-h16', 'cli-1', 'svc-corte', 'Rafael', at(-50, '09:00'), 'concluido'),
    makeAppointment('apt-h17', 'cli-2', 'svc-corte', 'Rafael', at(-33, '10:00'), 'faltou'),
    makeAppointment('apt-h18', 'cli-3', 'svc-combo', 'Rafael', at(-28, '14:00'), 'cancelado'),
  ]

  const templates: MessageTemplate[] = DEFAULT_TEMPLATES.map((template, index) => ({
    id: `tpl-${index + 1}`,
    businessId,
    name: template.name,
    category: template.category,
    body: template.body,
    active: true,
  }))

  const logs: MessageLog[] = [
    {
      id: 'log-1',
      businessId,
      clientId: 'cli-2',
      appointmentId: null,
      templateId: 'tpl-3',
      channel: 'whatsapp',
      messageContent: 'Feliz aniversário, Carlos Eduardo Lima! A equipe da Barbearia Corte Nobre deseja um dia especial.',
      status: 'manual',
      sentAt: at(0, '08:15'),
    },
  ]

  return {
    users: [
      {
        id: userId,
        email: 'demo@controlativa.com',
        password: 'demo123',
        fullName: 'Rafael Almeida',
        businessId,
      },
    ],
    businesses: [business],
    clients,
    services,
    professionals,
    appointments,
    templates,
    logs,
    accessRequests: [],
  }
}

function normalizeDb(db: DemoDb): DemoDb {
  if (!db.professionals) db.professionals = []

  for (const business of db.businesses) {
    if (!business.slug) business.slug = uniqueSlug(db, business.name, business.id)
    if (!business.timezone) business.timezone = 'America/Sao_Paulo'
    if (business.publicBookingEnabled === undefined) {
      business.publicBookingEnabled = true
    }
  }

  for (const appointment of db.appointments) {
    if (!appointment.source) appointment.source = 'internal'
    if (appointment.cancelToken === undefined) appointment.cancelToken = null
  }

  for (const business of db.businesses) {
    if (db.professionals.some((item) => item.businessId === business.id)) continue
    const names = new Set(
      db.appointments
        .filter((appointment) => appointment.businessId === business.id)
        .map((appointment) => appointment.professionalName)
        .filter((name): name is string => Boolean(name)),
    )
    if (names.size === 0) {
      const owner = db.users.find((user) => user.businessId === business.id)
      names.add(owner?.fullName || business.name)
    }
    for (const name of names) {
      db.professionals.push({
        id: uid(),
        businessId: business.id,
        name,
        active: true,
        createdAt: nowISO(),
      })
    }
  }

  return db
}

function loadDb(): DemoDb {
  const existing = readDb()
  if (existing) return normalizeDb(existing)
  const seeded = seedDb()
  writeDb(seeded)
  return seeded
}

function ensureBusiness(db: DemoDb, user: DemoUser): Business {
  const business = db.businesses.find((item) => item.id === user.businessId)
  if (!business) throw new Error('Negócio não encontrado.')
  return business
}

function duplicatePhone(
  db: DemoDb,
  businessId: string,
  phone: string,
  ignoreId?: string,
): Client | null {
  const digits = phone.replace(/\D/g, '')
  return (
    db.clients.find(
      (client) =>
        client.businessId === businessId &&
        !client.deletedAt &&
        client.id !== ignoreId &&
        client.phone.replace(/\D/g, '') === digits,
    ) ?? null
  )
}

function toClientPayload(input: ClientInput, businessId: string) {
  return {
    businessId,
    name: input.name.trim(),
    phone: input.phone,
    email: input.email?.trim() || null,
    birthDate: input.birthDate || null,
    notes: input.notes?.trim() || null,
    tags: input.tags ?? [],
    status: input.status,
    marketingConsent: input.marketingConsent,
    consentDate: input.marketingConsent
      ? input.consentDate ?? nowISO()
      : null,
  }
}

function buildAppointment(
  input: AppointmentInput,
  businessId: string,
): Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'> {
  const start = combineDateTime(input.date, input.startTime)
  if (Number.isNaN(start.getTime())) {
    throw new Error('Data ou horário inválido.')
  }
  const end = new Date(start.getTime() + input.durationMinutes * 60_000)
  return {
    businessId,
    clientId: input.clientId,
    serviceId: input.serviceId,
    professionalName: input.professionalName?.trim() || null,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    price: input.price,
    status: input.status,
    notes: input.notes?.trim() || null,
    source: 'internal',
    cancelToken: null,
  }
}

function formatConflictMessage(appointment: Appointment, db: DemoDb): string {
  const client = db.clients.find((item) => item.id === appointment.clientId)
  return `Este horário já está ocupado${client ? ` com ${client.name}` : ''}. Escolha outro horário ou profissional.`
}

export const demoApi: Api = {
  mode: 'demo',

  auth: {
    async getSession(): Promise<SessionUser | null> {
      const db = loadDb()
      const userId = getSessionUserId()
      if (!userId) return null
      const user = db.users.find((item) => item.id === userId)
      if (!user) return null
      return { id: user.id, email: user.email, fullName: user.fullName }
    },

    async signIn(email, password): Promise<SessionUser> {
      const db = loadDb()
      const user = db.users.find(
        (item) => item.email.toLowerCase() === email.trim().toLowerCase(),
      )
      if (!user || user.password !== password) {
        throw new Error('E-mail ou senha incorretos.')
      }
      localStorage.setItem(SESSION_KEY, user.id)
      return { id: user.id, email: user.email, fullName: user.fullName }
    },

    async signUp(input: SignUpInput): Promise<SignUpResult> {
      const db = loadDb()
      const email = input.email.trim().toLowerCase()
      if (db.users.some((user) => user.email.toLowerCase() === email)) {
        throw new Error('Já existe uma conta com este e-mail.')
      }

      const businessId = uid()
      const userId = uid()
      const business: Business = {
        id: businessId,
        ownerUserId: userId,
        name: input.businessName.trim(),
        slug: uniqueSlug(db, input.businessName),
        segment: 'outro',
        whatsappNumber: '',
        openingHours: DEFAULT_OPENING_HOURS,
        logoUrl: null,
        timezone: 'America/Sao_Paulo',
        publicBookingEnabled: true,
        plan: 'Plano Negócio',
        subscriptionStatus: 'trial',
        trialEndsAt: addDays(new Date(), TRIAL_DAYS).toISOString(),
        onboardingCompleted: false,
        accessRequestedAt: null,
        accessRequestNote: null,
        createdAt: nowISO(),
      }

      db.businesses.push(business)
      db.users.push({
        id: userId,
        email,
        password: input.password,
        fullName: input.fullName.trim(),
        businessId,
      })
      db.professionals.push({
        id: uid(),
        businessId,
        name: input.fullName.trim() || 'Profissional',
        active: true,
        createdAt: nowISO(),
      })

      DEFAULT_TEMPLATES.forEach((template) => {
        db.templates.push({
          id: uid(),
          businessId,
          name: template.name,
          category: template.category,
          body: template.body,
          active: true,
        })
      })

      const defaultServices = [
        { name: 'Atendimento rápido', durationMinutes: 30, price: 50 },
        { name: 'Atendimento padrão', durationMinutes: 60, price: 80 },
        { name: 'Atendimento completo', durationMinutes: 90, price: 120 },
      ]
      defaultServices.forEach((service) => {
        db.services.push({
          id: uid(),
          businessId,
          name: service.name,
          durationMinutes: service.durationMinutes,
          price: service.price,
          active: true,
        })
      })

      writeDb(db)
      localStorage.setItem(SESSION_KEY, userId)
      return {
        session: { id: userId, email, fullName: input.fullName.trim() },
        needsEmailConfirmation: false,
      }
    },

    async signOut(): Promise<void> {
      localStorage.removeItem(SESSION_KEY)
    },

    async resetPassword(): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, 400))
    },

    async updatePassword(password): Promise<void> {
      const db = loadDb()
      const user = requireUser(db)
      user.password = password
      writeDb(db)
    },
  },

  business: {
    async get(): Promise<Business> {
      const db = loadDb()
      return ensureBusiness(db, requireUser(db))
    },

    async update(input: BusinessInput): Promise<Business> {
      const db = loadDb()
      const user = requireUser(db)
      const business = ensureBusiness(db, user)
      const nextSlug = input.slug ? slugify(input.slug) : business.slug
      if (!nextSlug) throw new Error('Informe um link válido para a agenda online.')
      if (db.businesses.some((item) => item.slug === nextSlug && item.id !== business.id)) {
        throw new Error('Este link já está em uso por outro negócio.')
      }
      Object.assign(business, {
        name: input.name.trim(),
        slug: nextSlug,
        segment: input.segment,
        segmentCustom: input.segment === 'outro' ? (input.segmentCustom ?? null) : null,
        whatsappNumber: input.whatsappNumber,
        openingHours: input.openingHours,
        logoUrl: input.logoUrl,
        publicBookingEnabled:
          input.publicBookingEnabled ?? business.publicBookingEnabled,
        onboardingCompleted: input.onboardingCompleted ?? business.onboardingCompleted,
      })
      writeDb(db)
      return business
    },

    async requestAccess(input: AccessRequestInput): Promise<void> {
      const db = loadDb()
      const user = requireUser(db)
      const business = ensureBusiness(db, user)
      business.accessRequestedAt = nowISO()
      business.accessRequestNote = input.note ?? null
      db.accessRequests.push({
        ...input,
        id: uid(),
        businessId: business.id,
        createdAt: nowISO(),
      })
      writeDb(db)
    },

    async uploadLogo(file: File): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Não foi possível carregar a imagem.'))
        reader.readAsDataURL(file)
      })
    },
  },

  clients: {
    async list(): Promise<Client[]> {
      const db = loadDb()
      const user = requireUser(db)
      return db.clients
        .filter((client) => client.businessId === user.businessId && !client.deletedAt)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    },

    async get(id): Promise<Client | null> {
      const db = loadDb()
      const user = requireUser(db)
      return (
        db.clients.find(
          (client) =>
            client.id === id && client.businessId === user.businessId && !client.deletedAt,
        ) ?? null
      )
    },

    async create(input): Promise<Client> {
      const db = loadDb()
      const user = requireUser(db)
      if (duplicatePhone(db, user.businessId, input.phone)) {
        throw new Error('Já existe um cliente com este telefone.')
      }
      const payload = toClientPayload(input, user.businessId)
      const client: Client = {
        ...payload,
        id: uid(),
        deletedAt: null,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }
      db.clients.push(client)
      writeDb(db)
      return client
    },

    async update(id, input): Promise<Client> {
      const db = loadDb()
      const user = requireUser(db)
      const client = db.clients.find(
        (item) => item.id === id && item.businessId === user.businessId && !item.deletedAt,
      )
      if (!client) throw new Error('Cliente não encontrado.')
      if (duplicatePhone(db, user.businessId, input.phone, id)) {
        throw new Error('Já existe um cliente com este telefone.')
      }
      const payload = toClientPayload(input, user.businessId)
      const consentDate = input.marketingConsent
        ? client.marketingConsent && client.consentDate
          ? client.consentDate
          : input.consentDate ?? nowISO()
        : null
      Object.assign(client, payload, { consentDate, updatedAt: nowISO() })
      writeDb(db)
      return client
    },

    async softDelete(id): Promise<void> {
      const db = loadDb()
      const user = requireUser(db)
      const client = db.clients.find(
        (item) => item.id === id && item.businessId === user.businessId,
      )
      if (!client) throw new Error('Cliente não encontrado.')
      client.deletedAt = nowISO()
      client.status = 'inativo'
      client.updatedAt = nowISO()
      writeDb(db)
    },

    async importMany(rows: ClientImportRow[]) {
      const db = loadDb()
      const user = requireUser(db)
      let imported = 0
      let skipped = 0
      const errors: { line: number; message: string }[] = []

      rows.forEach((row, index) => {
        const line = index + 2
        if (duplicatePhone(db, user.businessId, row.phone)) {
          skipped += 1
          errors.push({ line, message: 'Telefone já cadastrado.' })
          return
        }
        const payload = toClientPayload(
          {
            name: row.name,
            phone: row.phone,
            email: row.email,
            birthDate: row.birthDate,
            notes: row.notes,
            tags: row.tags,
            status: 'ativo',
            marketingConsent: row.marketingConsent,
          },
          user.businessId,
        )
        db.clients.push({
          ...payload,
          id: uid(),
          deletedAt: null,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        })
        imported += 1
      })

      writeDb(db)
      return { imported, skipped, errors }
    },

    async checkDuplicatePhone(phone, ignoreId): Promise<Client | null> {
      const db = loadDb()
      const user = requireUser(db)
      return duplicatePhone(db, user.businessId, phone, ignoreId)
    },
  },

  services: {
    async list(): Promise<Service[]> {
      const db = loadDb()
      const user = requireUser(db)
      return db.services
        .filter((service) => service.businessId === user.businessId)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    },

    async create(input: ServiceInput): Promise<Service> {
      const db = loadDb()
      const user = requireUser(db)
      const service: Service = {
        id: uid(),
        businessId: user.businessId,
        name: input.name.trim(),
        durationMinutes: input.durationMinutes,
        price: input.price,
        active: input.active,
      }
      db.services.push(service)
      writeDb(db)
      return service
    },

    async update(id, input): Promise<Service> {
      const db = loadDb()
      const user = requireUser(db)
      const service = db.services.find(
        (item) => item.id === id && item.businessId === user.businessId,
      )
      if (!service) throw new Error('Serviço não encontrado.')
      Object.assign(service, {
        name: input.name.trim(),
        durationMinutes: input.durationMinutes,
        price: input.price,
        active: input.active,
      })
      writeDb(db)
      return service
    },

    async deactivate(id): Promise<void> {
      const db = loadDb()
      const user = requireUser(db)
      const service = db.services.find(
        (item) => item.id === id && item.businessId === user.businessId,
      )
      if (!service) throw new Error('Serviço não encontrado.')
      service.active = false
      writeDb(db)
    },
  },

  professionals: {
    async list(): Promise<Professional[]> {
      const db = loadDb()
      const user = requireUser(db)
      return db.professionals
        .filter((professional) => professional.businessId === user.businessId)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    },

    async create(input: ProfessionalInput): Promise<Professional> {
      const db = loadDb()
      const user = requireUser(db)
      const name = input.name.trim()
      if (!name) throw new Error('Informe o nome do profissional.')
      const duplicate = db.professionals.some(
        (professional) =>
          professional.businessId === user.businessId &&
          professional.name.toLowerCase() === name.toLowerCase(),
      )
      if (duplicate) throw new Error('Já existe um profissional com este nome.')
      const professional: Professional = {
        id: uid(),
        businessId: user.businessId,
        name,
        active: input.active,
        createdAt: nowISO(),
      }
      db.professionals.push(professional)
      writeDb(db)
      return professional
    },

    async update(id, input): Promise<Professional> {
      const db = loadDb()
      const user = requireUser(db)
      const professional = db.professionals.find(
        (item) => item.id === id && item.businessId === user.businessId,
      )
      if (!professional) throw new Error('Profissional não encontrado.')
      const name = input.name.trim()
      if (!name) throw new Error('Informe o nome do profissional.')
      const duplicate = db.professionals.some(
        (item) =>
          item.id !== id &&
          item.businessId === user.businessId &&
          item.name.toLowerCase() === name.toLowerCase(),
      )
      if (duplicate) throw new Error('Já existe um profissional com este nome.')
      professional.name = name
      professional.active = input.active
      writeDb(db)
      return professional
    },

    async deactivate(id): Promise<void> {
      const db = loadDb()
      const user = requireUser(db)
      const professional = db.professionals.find(
        (item) => item.id === id && item.businessId === user.businessId,
      )
      if (!professional) throw new Error('Profissional não encontrado.')
      professional.active = false
      writeDb(db)
    },
  },

  appointments: {
    async list(): Promise<Appointment[]> {
      const db = loadDb()
      const user = requireUser(db)
      return db.appointments
        .filter((appointment) => appointment.businessId === user.businessId)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    },

    async get(id): Promise<Appointment | null> {
      const db = loadDb()
      const user = requireUser(db)
      return (
        db.appointments.find(
          (appointment) =>
            appointment.id === id && appointment.businessId === user.businessId,
        ) ?? null
      )
    },

    async create(input): Promise<Appointment> {
      const db = loadDb()
      const user = requireUser(db)
      const payload = buildAppointment(input, user.businessId)
      const conflict = hasConflict(db.appointments, payload)
      if (conflict) throw new Error(formatConflictMessage(conflict, db))
      const appointment: Appointment = {
        ...payload,
        id: uid(),
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }
      db.appointments.push(appointment)
      writeDb(db)
      return appointment
    },

    async update(id, input): Promise<Appointment> {
      const db = loadDb()
      const user = requireUser(db)
      const appointment = db.appointments.find(
        (item) => item.id === id && item.businessId === user.businessId,
      )
      if (!appointment) throw new Error('Agendamento não encontrado.')
      const payload = buildAppointment(input, user.businessId)
      const conflict = hasConflict(db.appointments, { ...payload, id })
      if (conflict) throw new Error(formatConflictMessage(conflict, db))
      Object.assign(appointment, payload, { updatedAt: nowISO() })
      writeDb(db)
      return appointment
    },

    async setStatus(id, status): Promise<void> {
      const db = loadDb()
      const user = requireUser(db)
      const appointment = db.appointments.find(
        (item) => item.id === id && item.businessId === user.businessId,
      )
      if (!appointment) throw new Error('Agendamento não encontrado.')
      appointment.status = status
      appointment.updatedAt = nowISO()
      writeDb(db)
    },

    async remove(id): Promise<void> {
      const db = loadDb()
      const user = requireUser(db)
      db.appointments = db.appointments.filter(
        (item) => !(item.id === id && item.businessId === user.businessId),
      )
      writeDb(db)
    },
  },

  templates: {
    async list(): Promise<MessageTemplate[]> {
      const db = loadDb()
      const user = requireUser(db)
      return db.templates
        .filter((template) => template.businessId === user.businessId)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    },

    async update(id, input): Promise<MessageTemplate> {
      const db = loadDb()
      const user = requireUser(db)
      const template = db.templates.find(
        (item) => item.id === id && item.businessId === user.businessId,
      )
      if (!template) throw new Error('Modelo não encontrado.')
      Object.assign(template, input)
      writeDb(db)
      return template
    },

    async findByCategory(category: TemplateCategory): Promise<MessageTemplate | null> {
      const db = loadDb()
      const user = requireUser(db)
      return (
        db.templates.find(
          (template) =>
            template.businessId === user.businessId && template.category === category,
        ) ?? null
      )
    },
  },

  logs: {
    async list(): Promise<MessageLog[]> {
      const db = loadDb()
      const user = requireUser(db)
      return db.logs
        .filter((log) => log.businessId === user.businessId)
        .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    },

    async listByClient(clientId): Promise<MessageLog[]> {
      const db = loadDb()
      const user = requireUser(db)
      return db.logs
        .filter(
          (log) => log.businessId === user.businessId && log.clientId === clientId,
        )
        .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    },

    async create(input): Promise<MessageLog> {
      const db = loadDb()
      const user = requireUser(db)
      const log: MessageLog = {
        id: uid(),
        businessId: user.businessId,
        clientId: input.clientId,
        appointmentId: input.appointmentId ?? null,
        templateId: input.templateId ?? null,
        channel: 'whatsapp',
        messageContent: input.messageContent,
        status: input.status ?? 'manual',
        sentAt: nowISO(),
      }
      db.logs.push(log)
      writeDb(db)
      return log
    },
  },

  publicBooking: {
    async getBusiness(slug): Promise<PublicBusinessInfo | null> {
      const db = loadDb()
      const business = findPublicBusiness(db, slug)
      if (!business) return null

      return {
        business: {
          id: business.id,
          slug: business.slug,
          name: business.name,
          segment: business.segment,
          whatsappNumber: business.whatsappNumber,
          logoUrl: business.logoUrl,
          openingHours: business.openingHours,
          timezone: business.timezone,
        },
        services: db.services
          .filter((service) => service.businessId === business.id && service.active)
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
          .map((service) => ({
            id: service.id,
            name: service.name,
            durationMinutes: service.durationMinutes,
            price: service.price,
          })),
        professionals: db.professionals
          .filter(
            (professional) =>
              professional.businessId === business.id && professional.active,
          )
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
          .map((professional) => ({
            id: professional.id,
            name: professional.name,
          })),
      }
    },

    async getSlots({ slug, serviceId, professionalId, date }): Promise<PublicSlot[]> {
      const db = loadDb()
      const business = findPublicBusiness(db, slug)
      if (!business) return []
      const service = db.services.find(
        (item) => item.id === serviceId && item.businessId === business.id && item.active,
      )
      if (!service) return []
      const professionals = db.professionals.filter(
        (item) => item.businessId === business.id && item.active,
      )
      return getPublicSlots({
        dateKey: date,
        openingHours: business.openingHours,
        appointments: db.appointments.filter(
          (appointment) => appointment.businessId === business.id,
        ),
        professionals,
        service,
        professionalId,
        now: new Date(),
      })
    },

    async create(input): Promise<PublicBookingResult> {
      if (input.honeypot?.trim()) {
        throw new Error('Não foi possível concluir o agendamento.')
      }
      const db = loadDb()
      const business = findPublicBusiness(db, input.slug)
      if (!business) throw new Error('Agenda online indisponível.')

      const name = input.name.trim()
      if (name.length < 2) throw new Error('Informe seu nome completo.')
      const phone = normalizePhoneBR(input.phone)
      if (onlyDigits(phone).length < 12) throw new Error('Informe um WhatsApp válido.')

      const service = db.services.find(
        (item) =>
          item.id === input.serviceId &&
          item.businessId === business.id &&
          item.active,
      )
      if (!service) throw new Error('Serviço indisponível.')

      const start = new Date(input.startsAt)
      if (Number.isNaN(start.getTime())) throw new Error('Horário inválido.')
      const end = new Date(start.getTime() + service.durationMinutes * 60_000)

      const professionals = db.professionals.filter(
        (item) =>
          item.businessId === business.id &&
          item.active &&
          (!input.professionalId || item.id === input.professionalId),
      )
      if (professionals.length === 0) {
        throw new Error('Nenhum profissional disponível para este serviço.')
      }

      const dateKey = toDateKey(start)
      const slots = getPublicSlots({
        dateKey,
        openingHours: business.openingHours,
        appointments: db.appointments.filter(
          (appointment) => appointment.businessId === business.id,
        ),
        professionals,
        service,
        professionalId: input.professionalId,
        now: new Date(),
      })
      if (!slots.some((slot) => new Date(slot.startsAt).getTime() === start.getTime())) {
        throw new Error('Este horário não está mais disponível. Escolha outro.')
      }

      const businessAppointments = db.appointments.filter(
        (appointment) => appointment.businessId === business.id,
      )
      const professional = professionals.find(
        (item) =>
          !hasConflict(businessAppointments, {
            professionalName: item.name,
            startsAt: start.toISOString(),
            endsAt: end.toISOString(),
          }),
      )
      if (!professional) {
        throw new Error('Este horário não está mais disponível. Escolha outro.')
      }

      const activeForPhone = businessAppointments.filter((appointment) => {
        if (
          !ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status) ||
          new Date(appointment.startsAt) <= new Date()
        ) {
          return false
        }
        const client = db.clients.find((item) => item.id === appointment.clientId)
        return client?.phone.replace(/\D/g, '') === phone
      })
      if (activeForPhone.length >= BOOKING_MAX_ACTIVE_PER_PHONE) {
        throw new Error(
          'Você já possui agendamentos futuros. Fale com o negócio pelo WhatsApp.',
        )
      }

      let client = db.clients.find(
        (item) =>
          item.businessId === business.id &&
          !item.deletedAt &&
          item.phone.replace(/\D/g, '') === phone,
      )
      if (client) {
        if (input.marketingConsent && !client.marketingConsent) {
          client.marketingConsent = true
          client.consentDate = nowISO()
          client.updatedAt = nowISO()
        }
      } else {
        client = {
          id: uid(),
          businessId: business.id,
          name,
          phone,
          email: input.email?.trim() || null,
          birthDate: null,
          notes: null,
          tags: [],
          status: 'ativo',
          marketingConsent: input.marketingConsent,
          consentDate: input.marketingConsent ? nowISO() : null,
          deletedAt: null,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        }
        db.clients.push(client)
      }

      const appointment: Appointment = {
        id: uid(),
        businessId: business.id,
        clientId: client.id,
        serviceId: service.id,
        professionalName: professional.name,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        price: service.price,
        status: 'agendado',
        notes: input.notes?.trim() || null,
        source: 'public',
        cancelToken: uid(),
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }
      db.appointments.push(appointment)
      writeDb(db)

      return {
        id: appointment.id,
        cancelToken: appointment.cancelToken!,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        professionalName: appointment.professionalName,
        serviceName: service.name,
        price: appointment.price,
        status: appointment.status,
      }
    },

    async getAppointment(id, token): Promise<PublicAppointment | null> {
      const db = loadDb()
      const appointment = db.appointments.find(
        (item) => item.id === id && item.cancelToken === token,
      )
      if (!appointment) return null
      const business = db.businesses.find((item) => item.id === appointment.businessId)
      if (!business) return null
      const client = db.clients.find((item) => item.id === appointment.clientId)
      const service = db.services.find((item) => item.id === appointment.serviceId)
      const canCancel =
        ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status) &&
        new Date(appointment.startsAt).getTime() >
          Date.now() + BOOKING_MIN_NOTICE_MINUTES * 60_000

      return {
        id: appointment.id,
        businessName: business.name,
        businessSlug: business.slug,
        businessWhatsapp: business.whatsappNumber,
        serviceName: service?.name ?? null,
        professionalName: appointment.professionalName,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        price: appointment.price,
        status: appointment.status,
        clientName: client?.name ?? '',
        canCancel,
      }
    },

    async cancel(id, token): Promise<void> {
      const db = loadDb()
      const appointment = db.appointments.find(
        (item) => item.id === id && item.cancelToken === token,
      )
      if (!appointment) throw new Error('Agendamento não encontrado.')
      if (!ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) {
        throw new Error('Este agendamento não pode mais ser cancelado.')
      }
      if (
        new Date(appointment.startsAt).getTime() <=
        Date.now() + BOOKING_MIN_NOTICE_MINUTES * 60_000
      ) {
        throw new Error(
          'O cancelamento online não está disponível com menos de 2 horas de antecedência.',
        )
      }
      appointment.status = 'cancelado'
      appointment.updatedAt = nowISO()
      writeDb(db)
    },
  },

  dashboard: {
    async get() {
      const db = loadDb()
      const user = requireUser(db)
      const business = ensureBusiness(db, user)
      const clients = db.clients.filter(
        (client) => client.businessId === user.businessId && !client.deletedAt,
      )
      const appointments = db.appointments.filter(
        (appointment) => appointment.businessId === user.businessId,
      )
      const services = db.services.filter(
        (service) => service.businessId === user.businessId,
      )
      return buildDashboard({ clients, appointments, services, business })
    },
  },
}
