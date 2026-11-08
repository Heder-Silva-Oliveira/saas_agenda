import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, Check, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from '../../components/ui'
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_CLASSES,
} from '../../domain/constants'
import { hasConflict } from '../../domain/rules'
import { useAppointments, useClients, useServices } from '../../hooks/useData'
import {
  combineDateTime,
  formatCurrency,
  formatDateBR,
  formatTime,
  parseCurrencyBR,
  toDateKey,
} from '../../lib/format'
import { queryKeys } from '../../lib/queryClient'
import { api } from '../../services'
import type { Appointment, AppointmentInput } from '../../types'

const schema = z.object({
  clientId: z.string().min(1, 'Selecione o cliente.'),
  serviceId: z.string().optional(),
  professionalName: z.string().optional(),
  date: z.string().min(1, 'Informe a data.'),
  startTime: z.string().min(1, 'Informe o horário de início.'),
  durationMinutes: z
    .string()
    .min(1, 'Informe a duração.')
    .refine(
      (value) => Number(value) >= 15 && Number(value) <= 600,
      'A duração deve ser entre 15 e 600 minutos.',
    ),
  price: z
    .string()
    .min(1, 'Informe o valor.')
    .refine((value) => parseCurrencyBR(value) >= 0, 'Valor inválido.'),
  status: z.enum(['agendado', 'confirmado', 'concluido', 'faltou', 'cancelado']),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function AppointmentForm({
  appointment,
  defaultDate,
  defaultTime,
  defaultClientId,
}: {
  appointment?: Appointment
  defaultDate: string
  defaultTime: string
  defaultClientId?: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: clients = [] } = useClients()
  const { data: services = [] } = useServices()
  const { data: appointments = [] } = useAppointments()
  const [serverError, setServerError] = useState<string | null>(null)

  const activeServices = services.filter((service) => service.active)
  const initialService = appointment?.serviceId
    ? services.find((service) => service.id === appointment.serviceId)
    : activeServices[0]

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: appointment?.clientId ?? defaultClientId ?? '',
      serviceId: appointment?.serviceId ?? initialService?.id ?? '',
      professionalName: appointment?.professionalName ?? '',
      date: appointment ? toDateKey(appointment.startsAt) : defaultDate,
      startTime: appointment ? formatTime(appointment.startsAt) : defaultTime,
      durationMinutes: String(
        initialService?.durationMinutes ?? 60,
      ),
      price: String(appointment?.price ?? initialService?.price ?? 0),
      status: appointment?.status ?? 'agendado',
      notes: appointment?.notes ?? '',
    },
  })

  const date = watch('date')
  const startTime = watch('startTime')
  const duration = Number(watch('durationMinutes') || 0)
  const professionalName = watch('professionalName')



  const professionals = useMemo(() => {
    const set = new Set<string>()
    appointments.forEach((item) => {
      if (item.professionalName) set.add(item.professionalName)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [appointments])

  const conflict = useMemo(() => {
    if (!date || !startTime || !duration) return null
    const start = combineDateTime(date, startTime)
    if (Number.isNaN(start.getTime())) return null
    const end = new Date(start.getTime() + duration * 60_000)
    return hasConflict(appointments, {
      id: appointment?.id,
      professionalName,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    })
  }, [appointments, appointment?.id, date, startTime, duration, professionalName])

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    const payload: AppointmentInput = {
      clientId: values.clientId,
      serviceId: values.serviceId || null,
      professionalName: values.professionalName?.trim() || null,
      date: values.date,
      startTime: values.startTime,
      durationMinutes: Number(values.durationMinutes),
      price: parseCurrencyBR(values.price),
      status: values.status,
      notes: values.notes?.trim() || null,
    }

    try {
      if (appointment) {
        await api.appointments.update(appointment.id, payload)
        toast.success('Agendamento atualizado.')
      } else {
        await api.appointments.create(payload)
        toast.success('Agendamento criado.')
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      navigate(`/agenda?view=dia&data=${values.date}`, { replace: true })
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o agendamento.',
      )
    }
  })

  if (clients.length === 0) {
    return (
      <EmptyState
        icon={<UserPlus className="h-5 w-5" />}
        title="Cadastre um cliente primeiro"
        description="Para criar um agendamento, é necessário ter pelo menos um cliente cadastrado."
        action={
          <Link to="/clientes/novo">
            <Button leftIcon={<UserPlus className="h-4 w-4" />}>Novo cliente</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <PageHeader
        title={appointment ? 'Editar agendamento' : 'Novo agendamento'}
        description={
          appointment
            ? 'Remarque, altere o status ou atualize os dados do atendimento.'
            : 'Escolha o cliente, o serviço e um horário livre.'
        }
        backTo="/agenda"
        backLabel="Voltar à agenda"
      />

      <form onSubmit={onSubmit} className="space-y-4">
        <Card>
          <CardHeader title="Cliente e serviço" />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Select
              label="Cliente"
              required
              containerClassName="sm:col-span-2"
              error={errors.clientId?.message}
              {...register('clientId')}
            >
              <option value="">Selecione o cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} · {client.phone}
                </option>
              ))}
            </Select>

            <Select
              label="Serviço"
              hint={
                activeServices.length === 0
                  ? 'Nenhum serviço ativo. Cadastre em Configurações.'
                  : 'A duração e o valor são preenchidos automaticamente.'
              }
              {...register('serviceId')}
            >
              <option value="">Sem serviço</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.durationMinutes} min ·{' '}
                  {formatCurrency(service.price)}
                  {service.active ? '' : ' (inativo)'}
                </option>
              ))}
            </Select>

            <Input
              label="Profissional (opcional)"
              placeholder="Nome do profissional"
              list="professionals-list"
              {...register('professionalName')}
            />
            <datalist id="professionals-list">
              {professionals.map((professional) => (
                <option key={professional} value={professional} />
              ))}
            </datalist>

            <Input
              label="Duração (minutos)"
              type="number"
              min={15}
              step={15}
              required
              error={errors.durationMinutes?.message}
              {...register('durationMinutes')}
            />
            <Input
              label="Valor (R$)"
              inputMode="decimal"
              placeholder="0,00"
              required
              error={errors.price?.message}
              {...register('price')}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Data e horário" />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Input
              label="Data"
              type="date"
              required
              error={errors.date?.message}
              {...register('date')}
            />
            <Input
              label="Horário de início"
              type="time"
              required
              error={errors.startTime?.message}
              {...register('startTime')}
            />

            {date && startTime && duration > 0 && (
              <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600 sm:col-span-2">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4 text-stone-400" />
                  {formatDateBR(date)} · {startTime} às{' '}
                  {formatTime(
                    new Date(
                      combineDateTime(date, startTime).getTime() + duration * 60_000,
                    ).toISOString(),
                  )}
                </span>
              </div>
            )}

            {conflict && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200 sm:col-span-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Horário ocupado</p>
                  <p className="text-xs">
                    Já existe um atendimento das {formatTime(conflict.startsAt)} às{' '}
                    {formatTime(conflict.endsAt)} para este profissional. Escolha outro
                    horário.
                  </p>
                </div>
              </div>
            )}

            <Select label="Status" {...register('status')}>
              {(
                ['agendado', 'confirmado', 'concluido', 'faltou', 'cancelado'] as const
              ).map((status) => (
                <option key={status} value={status}>
                  {APPOINTMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>

            {appointment && (
              <div className="flex items-center sm:col-span-1">
                <Badge className={APPOINTMENT_STATUS_CLASSES[appointment.status]}>
                  Status atual: {APPOINTMENT_STATUS_LABELS[appointment.status]}
                </Badge>
              </div>
            )}

            <Textarea
              label="Observações (opcional)"
              placeholder="Preferências, avisos, detalhes do atendimento…"
              containerClassName="sm:col-span-2"
              {...register('notes')}
            />
          </div>
        </Card>

        {serverError && (
          <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
            {serverError}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link to="/agenda">
            <Button variant="secondary" fullWidth>
              Cancelar
            </Button>
          </Link>
          <Button
            type="submit"
            size="lg"
            loading={isSubmitting}
            disabled={Boolean(conflict)}
            leftIcon={<Check className="h-4 w-4" />}
          >
            {appointment ? 'Salvar alterações' : 'Criar agendamento'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export function AppointmentFormPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { data: appointments, isLoading } = useAppointments()

  if (id) {
    if (isLoading) return <LoadingState label="Carregando agendamento…" />
    const appointment = appointments?.find((item) => item.id === id)
    if (!appointment) {
      return (
        <EmptyState
          title="Agendamento não encontrado"
          description="Ele pode ter sido removido ou não pertence ao seu negócio."
          action={
            <Link to="/agenda">
              <Button>Voltar à agenda</Button>
            </Link>
          }
        />
      )
    }
    return (
      <AppointmentForm
        key={appointment.id}
        appointment={appointment}
        defaultDate={toDateKey(appointment.startsAt)}
        defaultTime={formatTime(appointment.startsAt)}
      />
    )
  }

  const today = new Date()
  const dateParam = searchParams.get('data')
  const timeParam = searchParams.get('hora')
  const clientParam = searchParams.get('cliente')

  return (
    <AppointmentForm
      defaultDate={dateParam ?? toDateKey(today)}
      defaultTime={timeParam ?? '09:00'}
      defaultClientId={clientParam ?? undefined}
    />
  )
}

