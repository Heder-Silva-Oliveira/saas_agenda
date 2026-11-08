import {
  addDays,
  addYears,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  isAfter,
  isBefore,
  startOfDay,
  startOfMonth,
} from 'date-fns'
import type {
  Appointment,
  AppointmentWithClient,
  Business,
  Client,
  DashboardData,
  DayHours,
  OpeningHours,
  Professional,
  PublicSlot,
  Service,
} from '../types'
import { ACTIVE_APPOINTMENT_STATUSES } from './constants'
import { toDate, toDateKey } from '../lib/format'
import { BOOKING_MAX_DAYS, BOOKING_MIN_NOTICE_MINUTES } from '../config'

export interface ConflictCandidate {
  id?: string
  professionalName?: string | null
  startsAt: string
  endsAt: string
}

function professionalKey(name?: string | null): string {
  return (name ?? '').trim().toLowerCase() || 'sem-profissional'
}

export function hasConflict(
  appointments: Appointment[],
  candidate: ConflictCandidate,
): Appointment | null {
  const candidateStart = new Date(candidate.startsAt).getTime()
  const candidateEnd = new Date(candidate.endsAt).getTime()
  const candidateProfessional = professionalKey(candidate.professionalName)

  return (
    appointments.find((appointment) => {
      if (candidate.id && appointment.id === candidate.id) return false
      if (!ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) return false
      if (professionalKey(appointment.professionalName) !== candidateProfessional) {
        return false
      }
      const start = new Date(appointment.startsAt).getTime()
      const end = new Date(appointment.endsAt).getTime()
      return candidateStart < end && candidateEnd > start
    }) ?? null
  )
}

export function getLastVisitMap(appointments: Appointment[]): Map<string, Date> {
  const map = new Map<string, Date>()
  appointments
    .filter((appointment) => appointment.status === 'concluido')
    .forEach((appointment) => {
      const date = toDate(appointment.startsAt)
      if (!date) return
      const current = map.get(appointment.clientId)
      if (!current || isAfter(date, current)) {
        map.set(appointment.clientId, date)
      }
    })
  return map
}

export function getLastVisitForClient(
  appointments: Appointment[],
  clientId: string,
): Date | null {
  return getLastVisitMap(appointments).get(clientId) ?? null
}

export function filterInactiveClients(
  clients: Client[],
  appointments: Appointment[],
  days: number,
  now = new Date(),
): Client[] {
  const lastVisits = getLastVisitMap(appointments)
  const cutoff = startOfDay(addDays(now, -days))

  return clients
    .filter((client) => !client.deletedAt && client.status === 'ativo')
    .filter((client) => {
      const lastVisit = lastVisits.get(client.id)
      if (lastVisit) return isBefore(lastVisit, cutoff)
      const createdAt = toDate(client.createdAt)
      return createdAt ? isBefore(createdAt, cutoff) : false
    })
}

export type BirthdayFilter = 'hoje' | 'semana' | 'mes'

export function getBirthdayDateInYear(client: Client, year: number): Date | null {
  const birthDate = toDate(client.birthDate)
  if (!birthDate) return null
  const date = new Date(year, birthDate.getMonth(), birthDate.getDate())
  return date
}

export function getNextBirthday(client: Client, now = new Date()): Date | null {
  const thisYear = getBirthdayDateInYear(client, now.getFullYear())
  if (!thisYear) return null
  if (isBefore(thisYear, startOfDay(now))) {
    return getBirthdayDateInYear(client, now.getFullYear() + 1)
  }
  return thisYear
}

export function getBirthdays(
  clients: Client[],
  filter: BirthdayFilter,
  now = new Date(),
): Client[] {
  const today = startOfDay(now)
  const weekEnd = endOfDay(addDays(today, 7))

  const matches = (client: Client): boolean => {
    const birthDate = toDate(client.birthDate)
    if (!birthDate) return false

    if (filter === 'mes') {
      return birthDate.getMonth() === now.getMonth()
    }

    if (filter === 'hoje') {
      return (
        birthDate.getMonth() === now.getMonth() && birthDate.getDate() === now.getDate()
      )
    }

    const thisYear = new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate())
    const candidate = isBefore(thisYear, today) ? addYears(thisYear, 1) : thisYear
    return (
      (isAfter(candidate, today) || candidate.getTime() === today.getTime()) &&
      isBefore(candidate, weekEnd)
    )
  }

  return clients
    .filter((client) => !client.deletedAt && matches(client))
    .sort((a, b) => {
      const dateA = toDate(a.birthDate)
      const dateB = toDate(b.birthDate)
      if (!dateA || !dateB) return 0
      return dateA.getDate() - dateB.getDate()
    })
}

export function enrichAppointments(
  appointments: Appointment[],
  clients: Client[],
  services: Service[],
): AppointmentWithClient[] {
  const clientMap = new Map(clients.map((client) => [client.id, client]))
  const serviceMap = new Map(services.map((service) => [service.id, service]))
  return appointments
    .map((appointment) => ({
      ...appointment,
      client: clientMap.get(appointment.clientId),
      service: appointment.serviceId ? serviceMap.get(appointment.serviceId) : undefined,
    }))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
}

export function buildDashboard(
  data: {
    clients: Client[]
    appointments: Appointment[]
    services: Service[]
    business: Business
  },
  now = new Date(),
): DashboardData {
  const { clients, appointments, business } = data
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const weekEnd = endOfDay(addDays(now, 7))
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const inRange = (iso: string, start: Date, end: Date) => {
    const date = toDate(iso)
    return Boolean(date && !isBefore(date, start) && !isAfter(date, end))
  }

  const todayAppointments = enrichAppointments(
    appointments.filter(
      (appointment) =>
        inRange(appointment.startsAt, todayStart, todayEnd) &&
        !['cancelado', 'faltou'].includes(appointment.status),
    ),
    clients,
    [],
  )

  const weekAppointments = enrichAppointments(
    appointments.filter(
      (appointment) =>
        inRange(appointment.startsAt, now, weekEnd) &&
        !['cancelado', 'faltou', 'concluido'].includes(appointment.status),
    ),
    clients,
    [],
  )

  const monthAppointments = appointments.filter((appointment) =>
    inRange(appointment.startsAt, monthStart, monthEnd),
  )

  const trialEndsAt = toDate(business.trialEndsAt)
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, differenceInCalendarDays(trialEndsAt, now))
    : 0

  return {
    activeClients: clients.filter(
      (client) => !client.deletedAt && client.status === 'ativo',
    ).length,
    todayAppointments,
    weekAppointments,
    todayBirthdays: getBirthdays(clients, 'hoje', now),
    monthBirthdays: getBirthdays(clients, 'mes', now),
    inactive: {
      days30: filterInactiveClients(clients, appointments, 30, now),
      days60: filterInactiveClients(clients, appointments, 60, now),
      days90: filterInactiveClients(clients, appointments, 90, now),
    },
    monthStats: {
      concluidos: monthAppointments.filter((a) => a.status === 'concluido').length,
      faltas: monthAppointments.filter((a) => a.status === 'faltou').length,
      cancelados: monthAppointments.filter((a) => a.status === 'cancelado').length,
      agendados: monthAppointments.filter((a) => a.status === 'agendado').length,
    },
    trialDaysLeft,
  }
}

export interface TimeSlot {
  time: string
  available: boolean
  appointment?: Appointment
}

function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + (minutes || 0)
}

function timeFromMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function getDaySlots(
  dateKey: string,
  openingHours: OpeningHours,
  appointments: Appointment[],
  professional?: string,
  intervalMinutes = 30,
): TimeSlot[] {
  const date = new Date(`${dateKey}T12:00:00`)
  const hours: DayHours | undefined = openingHours[String(date.getDay())]
  if (!hours || hours.closed) return []

  const dayAppointments = appointments.filter((appointment) => {
    if (!ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) return false
    if (toDateKey(appointment.startsAt) !== dateKey) return false
    if (professional && professionalKey(appointment.professionalName) !== professionalKey(professional)) {
      return false
    }
    return true
  })

  const start = minutesFromTime(hours.open)
  const end = minutesFromTime(hours.close)
  const slots: TimeSlot[] = []

  for (let current = start; current < end; current += intervalMinutes) {
    const slotStart = new Date(`${dateKey}T${timeFromMinutes(current)}:00`)
    const slotEnd = new Date(slotStart.getTime() + intervalMinutes * 60_000)
    const busy = dayAppointments.find((appointment) => {
      const appointmentStart = new Date(appointment.startsAt)
      const appointmentEnd = new Date(appointment.endsAt)
      return slotStart < appointmentEnd && slotEnd > appointmentStart
    })
    slots.push({
      time: timeFromMinutes(current),
      available: !busy,
      appointment: busy,
    })
  }

  return slots
}

export interface PublicSlotOptions {
  dateKey: string
  openingHours: OpeningHours
  appointments: Appointment[]
  professionals: Professional[]
  service: Pick<Service, 'durationMinutes'>
  professionalId?: string | null
  now?: Date
  minNoticeMinutes?: number
  maxDays?: number
}

export function getPublicSlots({
  dateKey,
  openingHours,
  appointments,
  professionals,
  service,
  professionalId,
  now = new Date(),
  minNoticeMinutes = BOOKING_MIN_NOTICE_MINUTES,
  maxDays = BOOKING_MAX_DAYS,
}: PublicSlotOptions): PublicSlot[] {
  const date = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(date.getTime())) return []

  const today = startOfDay(now)
  const limit = startOfDay(addDays(now, maxDays))
  if (isBefore(startOfDay(date), today) || isAfter(startOfDay(date), limit)) return []

  const hours = openingHours[String(date.getDay())]
  if (!hours || hours.closed) return []

  const candidates = professionals.filter(
    (professional) =>
      professional.active && (!professionalId || professional.id === professionalId),
  )
  if (candidates.length === 0) return []

  const dayAppointments = appointments.filter(
    (appointment) =>
      ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status) &&
      toDateKey(appointment.startsAt) === dateKey,
  )

  const minStart = new Date(now.getTime() + minNoticeMinutes * 60_000)
  const start = minutesFromTime(hours.open)
  const end = minutesFromTime(hours.close)
  const step = Math.max(5, service.durationMinutes)
  const slots: PublicSlot[] = []

  for (let current = start; current + service.durationMinutes <= end; current += step) {
    const slotStart = new Date(`${dateKey}T${timeFromMinutes(current)}:00`)
    if (Number.isNaN(slotStart.getTime()) || slotStart < minStart) continue

    const slotEnd = new Date(slotStart.getTime() + service.durationMinutes * 60_000)
    const free = candidates.some(
      (professional) =>
        !hasConflict(dayAppointments, {
          professionalName: professional.name,
          startsAt: slotStart.toISOString(),
          endsAt: slotEnd.toISOString(),
        }),
    )

    if (free) {
      slots.push({
        startsAt: slotStart.toISOString(),
        time: timeFromMinutes(current),
      })
    }
  }

  return slots
}

export function isTrialActive(business: Business, now = new Date()): boolean {
  if (business.subscriptionStatus === 'active') return true
  if (business.subscriptionStatus !== 'trial') return false
  const trialEndsAt = toDate(business.trialEndsAt)
  return Boolean(trialEndsAt && !isAfter(now, trialEndsAt))
}

