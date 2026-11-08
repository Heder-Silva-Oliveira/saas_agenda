import { useQueryClient } from '@tanstack/react-query'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquareText,
  Pencil,
  UserX,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import {
  APPOINTMENT_STATUS_CLASSES,
  APPOINTMENT_STATUS_LABELS,
  WEEKDAYS,
} from '../../domain/constants'
import { getDaySlots } from '../../domain/rules'
import { useAppointments, useClients, useServices, useTemplates } from '../../hooks/useData'
import {
  formatCurrency,
  formatDateLong,
  formatDateShort,
  formatTime,
  toDateKey,
} from '../../lib/format'
import { openWhatsApp, renderTemplate } from '../../lib/whatsapp'
import { queryKeys } from '../../lib/queryClient'
import { api } from '../../services'
import type { Appointment, AppointmentStatus, Client, Service } from '../../types'

type ViewMode = 'mes' | 'semana' | 'dia'

function statusDot(status: AppointmentStatus): string {
  return {
    agendado: 'bg-sky-500',
    confirmado: 'bg-emerald-500',
    concluido: 'bg-brand-500',
    faltou: 'bg-amber-500',
    cancelado: 'bg-rose-400',
  }[status]
}

function AppointmentActions({
  appointment,
  client,
  service,
  onStatus,
  onCancel,
  onReminder,
  pending,
}: {
  appointment: Appointment
  client?: Client
  service?: Service
  onStatus: (id: string, status: AppointmentStatus) => void
  onCancel: (appointment: Appointment) => void
  onReminder: (appointment: Appointment) => void
  pending: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {appointment.status === 'agendado' && (
        <Button
          size="sm"
          variant="outline"
          loading={pending}
          onClick={() => onStatus(appointment.id, 'confirmado')}
          leftIcon={<Check className="h-4 w-4" />}
        >
          Confirmar
        </Button>
      )}
      {['agendado', 'confirmado'].includes(appointment.status) && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onStatus(appointment.id, 'concluido')}
          leftIcon={<Check className="h-4 w-4" />}
        >
          Concluir
        </Button>
      )}
      {['agendado', 'confirmado'].includes(appointment.status) && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onStatus(appointment.id, 'faltou')}
          leftIcon={<UserX className="h-4 w-4" />}
        >
          Faltou
        </Button>
      )}
      {['agendado', 'confirmado'].includes(appointment.status) && (
        <Button
          size="sm"
          variant="ghost"
          className="text-rose-600 hover:bg-rose-50"
          onClick={() => onCancel(appointment)}
          leftIcon={<XCircle className="h-4 w-4" />}
        >
          Cancelar
        </Button>
      )}
      <Link to={`/agenda/${appointment.id}/editar`}>
        <Button size="sm" variant="ghost" leftIcon={<Pencil className="h-4 w-4" />}>
          Editar
        </Button>
      </Link>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onReminder(appointment)}
        leftIcon={<MessageSquareText className="h-4 w-4" />}
        aria-label="Enviar lembrete pelo WhatsApp"
      >
        Lembrete
      </Button>
      {client && (
        <span className="hidden text-xs text-stone-400 sm:inline">
          {service?.name ?? 'Serviço'} · {formatCurrency(appointment.price)}
        </span>
      )}
    </div>
  )
}

export function AgendaPage() {
  const { business } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: appointments = [], isLoading, isError, error, refetch } = useAppointments()
  const { data: clients = [] } = useClients()
  const { data: services = [] } = useServices()
  const { data: templates = [] } = useTemplates()
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [professionalFilter, setProfessionalFilter] = useState('')

  const view = (searchParams.get('view') as ViewMode) || 'mes'
  const dateParam = searchParams.get('data')
  const parsedDate = dateParam ? new Date(`${dateParam}T12:00:00`) : null
  const selectedDate =
    parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date()

  const clientMap = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  )
  const serviceMap = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  )

  const professionals = useMemo(() => {
    const set = new Set<string>()
    appointments.forEach((appointment) => {
      if (appointment.professionalName) set.add(appointment.professionalName)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [appointments])

  const updateParams = (next: { view?: ViewMode; date?: Date }) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', next.view ?? view)
    params.set('data', toDateKey(next.date ?? selectedDate))
    setSearchParams(params)
  }

  const navigate = (direction: -1 | 1) => {
    if (view === 'mes') updateParams({ date: addMonths(selectedDate, direction) })
    else if (view === 'semana') updateParams({ date: addWeeks(selectedDate, direction) })
    else updateParams({ date: addDays(selectedDate, direction) })
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
  }

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    setPendingId(id)
    try {
      await api.appointments.setStatus(id, status)
      invalidate()
      toast.success(`Atendimento marcado como ${APPOINTMENT_STATUS_LABELS[status].toLowerCase()}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status.')
    } finally {
      setPendingId(null)
    }
  }

  const cancelAppointment = async () => {
    if (!cancelTarget) return
    setPendingId(cancelTarget.id)
    try {
      await api.appointments.setStatus(cancelTarget.id, 'cancelado')
      invalidate()
      toast.success('Agendamento cancelado.')
      setCancelTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar.')
    } finally {
      setPendingId(null)
    }
  }

  const sendReminder = (appointment: Appointment) => {
    const client = clientMap.get(appointment.clientId)
    if (!client) return
    const service = appointment.serviceId ? serviceMap.get(appointment.serviceId) : undefined
    const template = templates.find((item) => item.category === 'lembrete')
    const body =
      template?.body ??
      'Olá {{nome_cliente}}! Lembrete do seu atendimento na {{nome_negocio}} em {{data}} às {{horario}}.'
    const message = renderTemplate(body, {
      nome_cliente: client.name.split(' ')[0],
      nome_negocio: business?.name,
      data: formatDateShort(appointment.startsAt),
      horario: formatTime(appointment.startsAt),
      servico: service?.name,
      profissional: appointment.professionalName ?? undefined,
    })
    openWhatsApp(client.phone, message)
    void api.logs
      .create({
        clientId: client.id,
        appointmentId: appointment.id,
        templateId: template?.id ?? null,
        messageContent: message,
      })
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.logs }))
      .catch(() => undefined)
  }

  const appointmentsForDay = (date: Date) => {
    const key = toDateKey(date)
    return appointments
      .filter((appointment) => toDateKey(appointment.startsAt) === key)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  }

  if (isLoading) return <LoadingState label="Carregando agenda…" />
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Erro ao carregar a agenda.'}
        onRetry={() => void refetch()}
      />
    )
  }

  const dayAppointments = appointmentsForDay(selectedDate)
  const daySlots = business
    ? getDaySlots(
        toDateKey(selectedDate),
        business.openingHours,
        appointments,
        professionalFilter || undefined,
      )
    : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
            Agenda
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Gerencie horários, confirme presenças e evite conflitos.
          </p>
        </div>
        <Link to="/agenda/novo">
          <Button leftIcon={<CalendarPlus className="h-4 w-4" />}>Novo agendamento</Button>
        </Link>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-xl bg-stone-100 p-1">
            {(['mes', 'semana', 'dia'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => updateParams({ view: mode })}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
                  view === mode
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {mode === 'mes' ? 'Mês' : mode === 'semana' ? 'Semana' : 'Dia'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => updateParams({ date: new Date() })}
              className="rounded-lg px-2 py-1 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Hoje
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(1)}
              aria-label="Próximo"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <p className="mt-2 border-t border-stone-100 pt-2 text-sm font-medium capitalize text-stone-700">
          {view === 'mes'
            ? format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })
            : view === 'semana'
              ? `${format(startOfWeek(selectedDate, { weekStartsOn: 0 }), 'dd/MM')} – ${format(
                  endOfWeek(selectedDate, { weekStartsOn: 0 }),
                  'dd/MM/yyyy',
                )}`
              : formatDateLong(selectedDate)}
        </p>
      </Card>

      {view === 'mes' && (
        <MonthView
          selectedDate={selectedDate}
          appointments={appointments}
          onSelectDay={(date) => updateParams({ view: 'dia', date })}
        />
      )}

      {view === 'semana' && (
        <WeekView
          selectedDate={selectedDate}
          appointments={appointments}
          clients={clientMap}
          onSelectDay={(date) => updateParams({ view: 'dia', date })}
        />
      )}

      {view === 'dia' && (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader
              title="Atendimentos do dia"
              description={`${dayAppointments.length} agendamento(s)`}
              action={
                <Link to={`/agenda/novo?data=${toDateKey(selectedDate)}`}>
                  <Button size="sm" variant="outline" leftIcon={<CalendarPlus className="h-4 w-4" />}>
                    Novo
                  </Button>
                </Link>
              }
            />
            {dayAppointments.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<CalendarDays className="h-5 w-5" />}
                  title="Nenhum atendimento neste dia"
                  description="Use os horários livres ao lado para agendar."
                />
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {dayAppointments.map((appointment) => {
                  const client = clientMap.get(appointment.clientId)
                  const service = appointment.serviceId
                    ? serviceMap.get(appointment.serviceId)
                    : undefined
                  return (
                    <div key={appointment.id} className="px-4 py-3 sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-14">
                          <p className="text-sm font-semibold text-stone-900">
                            {formatTime(appointment.startsAt)}
                          </p>
                          <p className="text-[11px] text-stone-400">
                            {formatTime(appointment.endsAt)}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-stone-900">
                            {client?.name ?? 'Cliente'}
                          </p>
                          <p className="truncate text-xs text-stone-500">
                            {service?.name ?? 'Serviço'}
                            {appointment.professionalName
                              ? ` · ${appointment.professionalName}`
                              : ''}{' '}
                            · {formatCurrency(appointment.price)}
                          </p>
                        </div>
                        <Badge className={APPOINTMENT_STATUS_CLASSES[appointment.status]}>
                          {APPOINTMENT_STATUS_LABELS[appointment.status]}
                        </Badge>
                      </div>
                      <div className="mt-2 pl-0 sm:pl-16">
                        <AppointmentActions
                          appointment={appointment}
                          client={client}
                          service={service}
                          onStatus={(id, status) => void updateStatus(id, status)}
                          onCancel={setCancelTarget}
                          onReminder={sendReminder}
                          pending={pendingId === appointment.id}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader
              title="Horários livres e ocupados"
              description={
                professionalFilter
                  ? `Profissional: ${professionalFilter}`
                  : 'Todos os profissionais'
              }
              action={
                professionals.length > 0 ? (
                  <Select
                    value={professionalFilter}
                    onChange={(event) => setProfessionalFilter(event.target.value)}
                    className="h-9 text-xs"
                  >
                    <option value="">Todos</option>
                    {professionals.map((professional) => (
                      <option key={professional} value={professional}>
                        {professional}
                      </option>
                    ))}
                  </Select>
                ) : undefined
              }
            />
            <div className="p-4">
              {daySlots.length === 0 ? (
                <EmptyState
                  icon={<Clock className="h-5 w-5" />}
                  title="Dia fechado"
                  description="O horário de funcionamento deste dia está fechado. Ajuste em Configurações."
                />
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {daySlots.map((slot) => (
                    <div
                      key={slot.time}
                      className={`rounded-xl border px-2.5 py-2 text-xs ${
                        slot.available
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-stone-200 bg-stone-100 text-stone-500'
                      }`}
                    >
                      <p className="font-semibold">{slot.time}</p>
                      {slot.available ? (
                        <Link
                          to={`/agenda/novo?data=${toDateKey(selectedDate)}&hora=${slot.time}`}
                          className="mt-0.5 block text-[11px] font-medium text-emerald-700 hover:underline"
                        >
                          Livre · agendar
                        </Link>
                      ) : (
                        <p className="mt-0.5 truncate text-[11px]">
                          {clientMap.get(slot.appointment?.clientId ?? '')?.name.split(' ')[0] ??
                            'Ocupado'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-stone-400">
                Intervalos de 30 minutos com base no horário de funcionamento.
              </p>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => void cancelAppointment()}
        title="Cancelar agendamento?"
        description={
          cancelTarget
            ? `${clientMap.get(cancelTarget.clientId)?.name ?? 'Cliente'} · ${formatTime(
                cancelTarget.startsAt,
              )}`
            : undefined
        }
        confirmLabel="Cancelar agendamento"
        cancelLabel="Manter"
        loading={pendingId === cancelTarget?.id}
        danger
      />
    </div>
  )
}

function MonthView({
  selectedDate,
  appointments,
  onSelectDay,
}: {
  selectedDate: Date
  appointments: Appointment[]
  onSelectDay: (date: Date) => void
}) {
  const gridStart = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 0 })
  const gridEnd = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    appointments.forEach((appointment) => {
      const key = toDateKey(appointment.startsAt)
      const list = map.get(key) ?? []
      list.push(appointment)
      map.set(key, list)
    })
    return map
  }, [appointments])

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-stone-100 bg-stone-50">
        {WEEKDAYS.map((day) => (
          <div
            key={day.value}
            className="px-1 py-2 text-center text-[11px] font-semibold uppercase text-stone-500"
          >
            {day.short}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = toDateKey(day)
          const items = (byDay.get(key) ?? []).sort(
            (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          )
          const isToday = isSameDay(day, new Date())
          const inMonth = isSameMonth(day, selectedDate)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`min-h-[86px] border-b border-r border-stone-100 p-1.5 text-left transition hover:bg-brand-50/50 ${
                inMonth ? 'bg-white' : 'bg-stone-50/60'
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isToday
                    ? 'bg-brand-700 text-white'
                    : inMonth
                      ? 'text-stone-700'
                      : 'text-stone-400'
                }`}
              >
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-0.5">
                {items.slice(0, 2).map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-1 truncate text-[10px] text-stone-600"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(appointment.status)}`} />
                    <span className="truncate">{formatTime(appointment.startsAt)}</span>
                  </div>
                ))}
                {items.length > 2 && (
                  <p className="text-[10px] font-medium text-brand-700">
                    +{items.length - 2} atendimento(s)
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function WeekView({
  selectedDate,
  appointments,
  clients,
  onSelectDay,
}: {
  selectedDate: Date
  appointments: Appointment[]
  clients: Map<string, Client>
  onSelectDay: (date: Date) => void
}) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  return (
    <div className="grid gap-2 overflow-x-auto sm:grid-cols-7">
      {days.map((day) => {
        const key = toDateKey(day)
        const items = appointments
          .filter((appointment) => toDateKey(appointment.startsAt) === key)
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        const isToday = isSameDay(day, new Date())
        return (
          <Card key={key} className="flex min-h-[180px] flex-col overflow-hidden">
            <button
              type="button"
              onClick={() => onSelectDay(day)}
              className={`border-b border-stone-100 px-2 py-2 text-center ${
                isToday ? 'bg-brand-50' : 'bg-stone-50'
              }`}
            >
              <p className="text-[11px] font-semibold uppercase text-stone-500">
                {format(day, 'EEE', { locale: ptBR })}
              </p>
              <p
                className={`text-sm font-semibold ${
                  isToday ? 'text-brand-800' : 'text-stone-800'
                }`}
              >
                {format(day, 'dd/MM')}
              </p>
            </button>
            <div className="flex-1 space-y-1 p-1.5">
              {items.length === 0 ? (
                <p className="py-3 text-center text-[11px] text-stone-400">Livre</p>
              ) : (
                items.map((appointment) => (
                  <Link
                    key={appointment.id}
                    to={`/agenda/${appointment.id}/editar`}
                    className="block rounded-lg border border-stone-100 bg-white px-1.5 py-1 text-[11px] shadow-sm transition hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <span className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot(appointment.status)}`} />
                      <span className="font-semibold text-stone-700">
                        {formatTime(appointment.startsAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-stone-600">
                      {clients.get(appointment.clientId)?.name.split(' ')[0] ?? 'Cliente'}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}


