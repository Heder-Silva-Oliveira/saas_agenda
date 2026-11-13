import type {
  Appointment,
  AppointmentStatus,
  Business,
  Client,
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
  SessionUser,
  SignUpInput,
  SignUpResult,
  TemplateCategory,
} from '../types'
import type { Api } from './types'
import { requireSupabase } from '../lib/supabase'
import { buildDashboard } from '../domain/rules'
import { combineDateTime } from '../lib/format'

const ACTIVE_STATUSES = ['agendado', 'confirmado', 'concluido']

function translateError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.'
  }
  if (normalized.includes('user already registered')) {
    return 'JÃ¡ existe uma conta com este e-mail.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.'
  }
  if (normalized.includes('password should be at least')) {
    return 'A senha deve ter pelo menos 6 caracteres.'
  }
  if (normalized.includes('duplicate key')) {
    return 'JÃ¡ existe um registro com estes dados.'
  }
  return message
}

function rowToBusiness(row: Record<string, any>): Business {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    slug: row.slug ?? '',
    segment: row.segment,
    whatsappNumber: row.whatsapp_number ?? '',
    openingHours: row.opening_hours ?? {},
    logoUrl: row.logo_url ?? null,
    timezone: row.timezone ?? 'America/Sao_Paulo',
    publicBookingEnabled: Boolean(row.public_booking_enabled ?? true),
    plan: row.plan ?? 'Plano NegÃ³cio',
    subscriptionStatus: row.subscription_status ?? 'trial',
    trialEndsAt: row.trial_ends_at,
    onboardingCompleted: Boolean(row.onboarding_completed),
    accessRequestedAt: row.access_requested_at ?? null,
    accessRequestNote: row.access_request_note ?? null,
    createdAt: row.created_at,
  }
}

function rowToClient(row: Record<string, any>): Client {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    email: row.email ?? null,
    birthDate: row.birth_date ?? null,
    notes: row.notes ?? null,
    tags: row.tags ?? [],
    status: row.status,
    marketingConsent: Boolean(row.marketing_consent),
    consentDate: row.consent_date ?? null,
    deletedAt: row.deleted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToService(row: Record<string, any>): Service {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    durationMinutes: row.duration_minutes,
    price: Number(row.price ?? 0),
    active: Boolean(row.active),
  }
}

function rowToAppointment(row: Record<string, any>): Appointment {
  return {
    id: row.id,
    businessId: row.business_id,
    clientId: row.client_id,
    serviceId: row.service_id ?? null,
    professionalName: row.professional_name || null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    price: Number(row.price ?? 0),
    status: row.status,
    notes: row.notes ?? null,
    source: row.source ?? 'internal',
    cancelToken: row.cancel_token ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToProfessional(row: Record<string, any>): Professional {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    active: Boolean(row.active),
    createdAt: row.created_at,
  }
}

function rowToTemplate(row: Record<string, any>): MessageTemplate {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    category: row.category,
    body: row.body,
    active: Boolean(row.active),
  }
}

function rowToLog(row: Record<string, any>): MessageLog {
  return {
    id: row.id,
    businessId: row.business_id,
    clientId: row.client_id,
    appointmentId: row.appointment_id ?? null,
    templateId: row.template_id ?? null,
    channel: row.channel,
    messageContent: row.message_content,
    status: row.status,
    sentAt: row.sent_at,
  }
}

async function getProfile(): Promise<{ userId: string; businessId: string; fullName: string }> {
  const client = requireSupabase()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) throw new Error('SessÃ£o expirada. FaÃ§a login novamente.')
  const { data, error } = await client
    .from('profiles')
    .select('business_id, full_name')
    .eq('user_id', auth.user.id)
    .maybeSingle()
  if (error) throw new Error(translateError(error.message))
  if (!data) throw new Error('Perfil nÃ£o encontrado. Conclua o cadastro do negÃ³cio.')
  return {
    userId: auth.user.id,
    businessId: data.business_id,
    fullName: data.full_name,
  }
}

async function currentBusinessId(): Promise<string> {
  const profile = await getProfile()
  return profile.businessId
}

export const supabaseApi: Api = {
  mode: 'supabase',

  auth: {
    async getSession(): Promise<SessionUser | null> {
      const client = requireSupabase()
      const { data } = await client.auth.getSession()
      if (!data.session?.user) return null
      const user = data.session.user
      let fullName = (user.user_metadata?.full_name as string) ?? ''
      const { data: profile } = await client
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle()
      if (profile?.full_name) fullName = profile.full_name
      return { id: user.id, email: user.email ?? '', fullName }
    },

    async signIn(email, password): Promise<SessionUser> {
      const client = requireSupabase()
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw new Error(translateError(error.message))
      if (!data.user) throw new Error('NÃ£o foi possÃ­vel entrar. Tente novamente.')
      return {
        id: data.user.id,
        email: data.user.email ?? email,
        fullName: (data.user.user_metadata?.full_name as string) ?? '',
      }
    },

    async signUp(input: SignUpInput): Promise<SignUpResult> {
      const client = requireSupabase()
      const { data, error } = await client.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          data: {
            full_name: input.fullName.trim(),
            business_name: input.businessName.trim(),
          },
        },
      })
      if (error) throw new Error(translateError(error.message))
      if (!data.session || !data.user) {
        return { session: null, needsEmailConfirmation: true }
      }
      return {
        session: {
          id: data.user.id,
          email: data.user.email ?? input.email,
          fullName: input.fullName.trim(),
        },
        needsEmailConfirmation: false,
      }
    },

    async signOut(): Promise<void> {
      const client = requireSupabase()
      await client.auth.signOut()
    },

    async resetPassword(email): Promise<void> {
      const client = requireSupabase()
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      })
      if (error) throw new Error(translateError(error.message))
    },

    async updatePassword(password): Promise<void> {
      const client = requireSupabase()
      const { error } = await client.auth.updateUser({ password })
      if (error) throw new Error(translateError(error.message))
    },
  },

  business: {
    async get(): Promise<Business> {
      const client = requireSupabase()
      const profile = await getProfile()
      const { data, error } = await client
        .from('businesses')
        .select('*')
        .eq('id', profile.businessId)
        .single()
      if (error) throw new Error(translateError(error.message))
      return rowToBusiness(data)
    },

    async update(input): Promise<Business> {
      const client = requireSupabase()
      const businessId = await currentBusinessId()
      const { data, error } = await client
        .from('businesses')
        .update({
          name: input.name.trim(),
          slug: input.slug,
          segment: input.segment,
        segment_custom: input.segment === 'outro' ? (input.segmentCustom ?? null) : null,
          whatsapp_number: input.whatsappNumber,
          opening_hours: input.openingHours,
          logo_url: input.logoUrl,
          public_booking_enabled: input.publicBookingEnabled,
          onboarding_completed: input.onboardingCompleted ?? true,
        })
        .eq('id', businessId)
        .select()
        .single()
      if (error) throw new Error(translateError(error.message))
      return rowToBusiness(data)
    },

    async requestAccess(input): Promise<void> {
      const client = requireSupabase()
      const businessId = await currentBusinessId()
      const note = [
        input.note?.trim(),
        `Contato: ${input.name} | ${input.email} | ${input.phone}`,
      ]
        .filter(Boolean)
        .join(' â€” ')
      const { error } = await client
        .from('businesses')
        .update({
          access_requested_at: new Date().toISOString(),
          access_request_note: note,
        })
        .eq('id', businessId)
      if (error) throw new Error(translateError(error.message))
    },

    async uploadLogo(file): Promise<string> {
      const client = requireSupabase()
      const businessId = await currentBusinessId()
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${businessId}/logo-${Date.now()}.${extension}`
      const { error } = await client.storage.from('logos').upload(path, file, {
        upsert: true,
        cacheControl: '3600',
      })
      if (error) throw new Error(translateError(error.message))
      const { data } = client.storage.from('logos').getPublicUrl(path)
      return data.publicUrl
    },
  },

  clients: {
    async list(): Promise<Client[]> {
      const client = requireSupabase()
      const { data, error } = await client
        .from('clients')
        .select('*')
        .is('deleted_at', null)
        .order('name', { ascending: true })
      if (error) throw new Error(translateError(error.message))
      return (data ?? []).map(rowToClient)
    },

    async get(id): Promise<Client | null> {
      const client = requireSupabase()
      const { data, error } = await client
        .from('clients')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) throw new Error(translateError(error.message))
      return data ? rowToClient(data) : null
    },

    async create(input): Promise<Client> {
      const client = requireSupabase()
      const businessId = await currentBusinessId()
      const duplicate = await supabaseApi.clients.checkDuplicatePhone(input.phone)
      if (duplicate) throw new Error('JÃ¡ existe um cliente com este telefone.')
      const { data, error } = await client
        .from('clients')
        .insert({
          business_id: businessId,
          name: input.name.trim(),
          phone: input.phone,
          email: input.email?.trim() || null,
          birth_date: input.birthDate || null,
          notes: input.notes?.trim() || null,
          tags: input.tags ?? [],
          status: input.status,
          marketing_consent: input.marketingConsent,
          consent_date: input.marketingConsent
            ? input.consentDate ?? new Date().toISOString()
            : null,
        })
        .select()
        .single()
      if (error) {
        if (error.code === '23505') {
          throw new Error('JÃ¡ existe um cliente com este telefone.')
        }
        throw new Error(translateError(error.message))
      }
      return rowToClient(data)
    },

    async update(id, input): Promise<Client> {
      const client = requireSupabase()
      const duplicate = await supabaseApi.clients.checkDuplicatePhone(input.phone, id)
      if (duplicate) throw new Error('JÃ¡ existe um cliente com este telefone.')
      const { data, error } = await client
        .from('clients')
        .update({
          name: input.name.trim(),
          phone: input.phone,
          email: input.email?.trim() || null,
          birth_date: input.birthDate || null,
          notes: input.notes?.trim() || null,
          tags: input.tags ?? [],
          status: input.status,
          marketing_consent: input.marketingConsent,
          consent_date: input.marketingConsent
            ? input.consentDate ?? new Date().toISOString()
            : null,
        })
        .eq('id', id)
        .select()
        .single()
      if (error) {
        if (error.code === '23505') {
          throw new Error('JÃ¡ existe um cliente com este telefone.')
        }
        throw new Error(translateError(error.message))
      }
      return rowToClient(data)
    },

    async softDelete(id): Promise<void> {
      const client = requireSupabase()
      const { error } = await client
        .from('clients')
        .update({ deleted_at: new Date().toISOString(), status: 'inativo' })
        .eq('id', id)
      if (error) throw new Error(translateError(error.message))
    },

    async importMany(rows) {
      const client = requireSupabase()
      const businessId = await currentBusinessId()
      let imported = 0
      let skipped = 0
      const errors: { line: number; message: string }[] = []

      for (const [index, row] of rows.entries()) {
        const line = index + 2
        const duplicate = await supabaseApi.clients.checkDuplicatePhone(row.phone)
        if (duplicate) {
          skipped += 1
          errors.push({ line, message: 'Telefone jÃ¡ cadastrado.' })
          continue
        }
        const { error } = await client.from('clients').insert({
          business_id: businessId,
          name: row.name,
          phone: row.phone,
          email: row.email || null,
          birth_date: row.birthDate || null,
          notes: row.notes || null,
          tags: row.tags ?? [],
          status: 'ativo',
          marketing_consent: row.marketingConsent,
          consent_date: row.marketingConsent ? new Date().toISOString() : null,
        })
        if (error) {
          skipped += 1
          errors.push({ line, message: translateError(error.message) })
        } else {
          imported += 1
        }
      }

      return { imported, skipped, errors }
    },

    async checkDuplicatePhone(phone, ignoreId) {
      const client = requireSupabase()
      const digits = phone.replace(/\D/g, '')
      const { data, error } = await client
        .from('clients')
        .select('*')
        .is('deleted_at', null)
        .eq('phone', digits)
        .maybeSingle()
      if (error) throw new Error(translateError(error.message))
      if (!data) return null
      if (ignoreId && data.id === ignoreId) return null
      return rowToClient(data)
    },
  },

  services: {
    async list(): Promise<Service[]> {
      const client = requireSupabase()
      const { data, error } = await client
        .from('services')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw new Error(translateError(error.message))
      return (data ?? []).map(rowToService)
    },

    async create(input) {
      const client = requireSupabase()
      const businessId = await currentBusinessId()
      const { data, error } = await client
        .from('services')
        .insert({
          business_id: businessId,
          name: input.name.trim(),
          duration_minutes: input.durationMinutes,
          price: input.price,
          active: input.active,
        })
        .select()
        .single()
      if (error) throw new Error(translateError(error.message))
      return rowToService(data)
    },

    async update(id, input) {
      const client = requireSupabase()
      const { data, error } = await client
        .from('services')
        .update({
          name: input.name.trim(),
          duration_minutes: input.durationMinutes,
          price: input.price,
          active: input.active,
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(translateError(error.message))
      return rowToService(data)
    },

    async deactivate(id) {
      const client = requireSupabase()
      const { error } = await client.from('services').update({ active: false }).eq('id', id)
      if (error) throw new Error(translateError(error.message))
    },
  },

  professionals: {
    async list(): Promise<Professional[]> {
      const client = requireSupabase()
      const { data, error } = await client
        .from('professionals')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw new Error(translateError(error.message))
      return (data ?? []).map(rowToProfessional)
    },

    async create(input: ProfessionalInput): Promise<Professional> {
      const client = requireSupabase()
      const businessId = await currentBusinessId()
      const { data, error } = await client
        .from('professionals')
        .insert({
          business_id: businessId,
          name: input.name.trim(),
          active: input.active,
        })
        .select()
        .single()
      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe um profissional com este nome.')
        }
        throw new Error(translateError(error.message))
      }
      return rowToProfessional(data)
    },

    async update(id, input): Promise<Professional> {
      const client = requireSupabase()
      const { data, error } = await client
        .from('professionals')
        .update({ name: input.name.trim(), active: input.active })
        .eq('id', id)
        .select()
        .single()
      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe um profissional com este nome.')
        }
        throw new Error(translateError(error.message))
      }
      return rowToProfessional(data)
    },

    async deactivate(id): Promise<void> {
      const client = requireSupabase()
      const { error } = await client
        .from('professionals')
        .update({ active: false })
        .eq('id', id)
      if (error) throw new Error(translateError(error.message))
    },
  },

  appointments: {
    async list(): Promise<Appointment[]> {
      const client = requireSupabase()
      const { data, error } = await client
        .from('appointments')
        .select('*')
        .order('starts_at', { ascending: true })
      if (error) throw new Error(translateError(error.message))
      return (data ?? []).map(rowToAppointment)
    },

    async get(id) {
      const client = requireSupabase()
      const { data, error } = await client
        .from('appointments')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw new Error(translateError(error.message))
      return data ? rowToAppointment(data) : null
    },

    async create(input) {
      const client = requireSupabase()
      const businessId = await currentBusinessId()
      const start = combineDateTime(input.date, input.startTime)
      if (Number.isNaN(start.getTime())) throw new Error('Data ou horÃ¡rio invÃ¡lido.')
      const end = new Date(start.getTime() + input.durationMinutes * 60_000)

      const { data: overlapping, error: conflictError } = await client
        .from('appointments')
        .select('*')
        .in('status', ACTIVE_STATUSES)
        .lt('starts_at', end.toISOString())
        .gt('ends_at', start.toISOString())
        .eq('professional_name', input.professionalName?.trim() || '')
      if (conflictError) throw new Error(translateError(conflictError.message))
      if (overlapping && overlapping.length > 0) {
        throw new Error('Este horÃ¡rio jÃ¡ estÃ¡ ocupado para este profissional.')
      }

      const { data, error } = await client
        .from('appointments')
        .insert({
          business_id: businessId,
          client_id: input.clientId,
          service_id: input.serviceId,
          professional_name: input.professionalName?.trim() || '',
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          price: input.price,
          status: input.status,
          notes: input.notes?.trim() || null,
        })
        .select()
        .single()
      if (error) {
        if (error.code === '23P01' || error.message.includes('exclusion')) {
          throw new Error('Este horÃ¡rio jÃ¡ estÃ¡ ocupado para este profissional.')
        }
        throw new Error(translateError(error.message))
      }
      return rowToAppointment(data)
    },

    async update(id, input) {
      const client = requireSupabase()
      const start = combineDateTime(input.date, input.startTime)
      if (Number.isNaN(start.getTime())) throw new Error('Data ou horÃ¡rio invÃ¡lido.')
      const end = new Date(start.getTime() + input.durationMinutes * 60_000)

      const { data: overlapping, error: conflictError } = await client
        .from('appointments')
        .select('*')
        .in('status', ACTIVE_STATUSES)
        .lt('starts_at', end.toISOString())
        .gt('ends_at', start.toISOString())
        .eq('professional_name', input.professionalName?.trim() || '')
        .neq('id', id)
      if (conflictError) throw new Error(translateError(conflictError.message))
      if (overlapping && overlapping.length > 0) {
        throw new Error('Este horÃ¡rio jÃ¡ estÃ¡ ocupado para este profissional.')
      }

      const { data, error } = await client
        .from('appointments')
        .update({
          client_id: input.clientId,
          service_id: input.serviceId,
          professional_name: input.professionalName?.trim() || '',
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          price: input.price,
          status: input.status,
          notes: input.notes?.trim() || null,
        })
        .eq('id', id)
        .select()
        .single()
      if (error) {
        if (error.code === '23P01' || error.message.includes('exclusion')) {
          throw new Error('Este horÃ¡rio jÃ¡ estÃ¡ ocupado para este profissional.')
        }
        throw new Error(translateError(error.message))
      }
      return rowToAppointment(data)
    },

    async setStatus(id, status: AppointmentStatus) {
      const client = requireSupabase()
      const { error } = await client
        .from('appointments')
        .update({ status })
        .eq('id', id)
      if (error) throw new Error(translateError(error.message))
    },

    async remove(id) {
      const client = requireSupabase()
      const { error } = await client.from('appointments').delete().eq('id', id)
      if (error) throw new Error(translateError(error.message))
    },
  },

  templates: {
    async list() {
      const client = requireSupabase()
      const { data, error } = await client
        .from('message_templates')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw new Error(translateError(error.message))
      return (data ?? []).map(rowToTemplate)
    },

    async update(id, input) {
      const client = requireSupabase()
      const { data, error } = await client
        .from('message_templates')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(translateError(error.message))
      return rowToTemplate(data)
    },

    async findByCategory(category: TemplateCategory) {
      const client = requireSupabase()
      const { data, error } = await client
        .from('message_templates')
        .select('*')
        .eq('category', category)
        .maybeSingle()
      if (error) throw new Error(translateError(error.message))
      return data ? rowToTemplate(data) : null
    },
  },

  logs: {
    async list() {
      const client = requireSupabase()
      const { data, error } = await client
        .from('message_logs')
        .select('*')
        .order('sent_at', { ascending: false })
      if (error) throw new Error(translateError(error.message))
      return (data ?? []).map(rowToLog)
    },

    async listByClient(clientId) {
      const client = requireSupabase()
      const { data, error } = await client
        .from('message_logs')
        .select('*')
        .eq('client_id', clientId)
        .order('sent_at', { ascending: false })
      if (error) throw new Error(translateError(error.message))
      return (data ?? []).map(rowToLog)
    },

    async create(input) {
      const client = requireSupabase()
      const businessId = await currentBusinessId()
      const { data, error } = await client
        .from('message_logs')
        .insert({
          business_id: businessId,
          client_id: input.clientId,
          appointment_id: input.appointmentId ?? null,
          template_id: input.templateId ?? null,
          channel: 'whatsapp',
          message_content: input.messageContent,
          status: input.status ?? 'manual',
        })
        .select()
        .single()
      if (error) throw new Error(translateError(error.message))
      return rowToLog(data)
    },
  },

  publicBooking: {
    async getBusiness(slug: string): Promise<PublicBusinessInfo | null> {
      const client = requireSupabase()
      const { data, error } = await client.rpc('public_business', { p_slug: slug })
      if (error) throw new Error(translateError(error.message))
      if (!data) return null
      return data as PublicBusinessInfo
    },

    async getSlots({
      slug,
      serviceId,
      professionalId,
      date,
    }): Promise<PublicSlot[]> {
      const client = requireSupabase()
      const { data, error } = await client.rpc('public_slots', {
        p_slug: slug,
        p_service_id: serviceId,
        p_professional_id: professionalId ?? null,
        p_date: date,
      })
      if (error) throw new Error(translateError(error.message))
      return (data ?? []) as PublicSlot[]
    },

    async create(input: PublicBookingInput): Promise<PublicBookingResult> {
      if (input.honeypot?.trim()) {
        throw new Error('Não foi possível concluir o agendamento.')
      }
      const client = requireSupabase()
      const { data, error } = await client.rpc('public_book', {
        p_slug: input.slug,
        p_service_id: input.serviceId,
        p_professional_id: input.professionalId ?? null,
        p_starts_at: input.startsAt,
        p_name: input.name.trim(),
        p_phone: input.phone,
        p_email: input.email?.trim() || null,
        p_notes: input.notes?.trim() || null,
        p_marketing_consent: input.marketingConsent,
      })
      if (error) throw new Error(translateError(error.message))
      return data as PublicBookingResult
    },

    async getAppointment(id, token): Promise<PublicAppointment | null> {
      const client = requireSupabase()
      const { data, error } = await client.rpc('public_booking', {
        p_id: id,
        p_token: token,
      })
      if (error) throw new Error(translateError(error.message))
      if (!data) return null
      return data as PublicAppointment
    },

    async cancel(id, token): Promise<void> {
      const client = requireSupabase()
      const { error } = await client.rpc('public_cancel', {
        p_id: id,
        p_token: token,
      })
      if (error) throw new Error(translateError(error.message))
    },
  },

  dashboard: {
    async get() {
      const client = requireSupabase()
      const businessId = await currentBusinessId()
      const [clientsRes, appointmentsRes, servicesRes, businessRes] = await Promise.all([
        client.from('clients').select('*').is('deleted_at', null),
        client.from('appointments').select('*'),
        client.from('services').select('*'),
        client.from('businesses').select('*').eq('id', businessId).single(),
      ])
      if (clientsRes.error) throw new Error(translateError(clientsRes.error.message))
      if (appointmentsRes.error) {
        throw new Error(translateError(appointmentsRes.error.message))
      }
      if (servicesRes.error) throw new Error(translateError(servicesRes.error.message))
      if (businessRes.error) throw new Error(translateError(businessRes.error.message))

      return buildDashboard({
        clients: (clientsRes.data ?? []).map(rowToClient),
        appointments: (appointmentsRes.data ?? []).map(rowToAppointment),
        services: (servicesRes.data ?? []).map(rowToService),
        business: rowToBusiness(businessRes.data),
      })
    },
  },
}

