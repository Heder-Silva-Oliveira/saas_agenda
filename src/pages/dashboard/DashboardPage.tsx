import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarPlus,
  Cake,
  Check,
  ChevronRight,
  Clock,
  MessageSquareText,
  Sparkles,
  UserPlus,
  Users,
  UserX,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, ListSkeleton, StatCard } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useDashboard, useTemplates } from '../../hooks/useData'
import {
  APPOINTMENT_STATUS_CLASSES,
  APPOINTMENT_STATUS_LABELS,
} from '../../domain/constants'
import {
  formatDateLong,
  formatDateBR,
  formatTime,
  toDateKey,
} from '../../lib/format'
import { openWhatsApp, renderTemplate } from '../../lib/whatsapp'
import { queryClient as client, queryKeys } from '../../lib/queryClient'
import { api } from '../../services'
import type { AppointmentWithClient } from '../../types'

export function DashboardPage() {
  const { business, session } = useAuth()
  const { data, isLoading, isError, error, refetch } = useDashboard()
  const { data: templates } = useTemplates()
  const queryClient = useQueryClient()

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.appointments.setStatus(id, 'confirmado'),
    onSuccess: () => {
      toast.success('Presença confirmada.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao confirmar.'),
  })

  const reminderTemplate = templates?.find((template) => template.category === 'lembrete')
  const firstName = session?.fullName.split(' ')[0] ?? ''
  const trialDays = data?.trialDaysLeft ?? 0

  const sendReminder = (appointment: AppointmentWithClient) => {
    if (!appointment.client) return
    const body =
      reminderTemplate?.body ??
      'Olá {{nome_cliente}}! Lembrete do seu atendimento na {{nome_negocio}} em {{data}} às {{horario}}.'
    const message = renderTemplate(body, {
      nome_cliente: appointment.client.name.split(' ')[0],
      nome_negocio: business?.name,
      data: formatDateBR(appointment.startsAt),
      horario: formatTime(appointment.startsAt),
      servico: appointment.service?.name,
      profissional: appointment.professionalName ?? undefined,
    })
    openWhatsApp(appointment.client.phone, message)
    void api.logs
      .create({
        clientId: appointment.client.id,
        appointmentId: appointment.id,
        templateId: reminderTemplate?.id ?? null,
        messageContent: message,
      })
      .then(() => client.invalidateQueries({ queryKey: queryKeys.logs }))
      .catch(() => undefined)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-stone-200" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-stone-200/70" />
          ))}
        </div>
        <ListSkeleton rows={3} />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Erro ao carregar o painel.'}
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">{formatDateLong(new Date())}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
            Olá, {firstName}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {data.todayAppointments.length > 0
              ? `Você tem ${data.todayAppointments.length} atendimento(s) hoje.`
              : 'Nenhum atendimento agendado para hoje.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/clientes/novo">
            <Button variant="secondary" size="sm" leftIcon={<UserPlus className="h-4 w-4" />}>
              Novo cliente
            </Button>
          </Link>
          <Link to="/agenda/novo">
            <Button size="sm" leftIcon={<CalendarPlus className="h-4 w-4" />}>
              Novo agendamento
            </Button>
          </Link>
        </div>
      </div>

      {business?.subscriptionStatus === 'trial' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
            <div>
              <p className="text-sm font-semibold text-brand-900">
                Período de implantação: {trialDays} dia(s) restante(s)
              </p>
              <p className="text-xs text-brand-700">
                {business.accessRequestedAt
                  ? 'Sua solicitação de acesso foi registrada. Entraremos em contato.'
                  : `Acesso completo até ${formatDateBR(business.trialEndsAt)}. Garanta sua assinatura para continuar depois.`}
              </p>
            </div>
          </div>
          <Link to="/assinatura">
            <Button size="sm" variant="outline" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Ver assinatura
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Clientes ativos"
          value={data.activeClients}
          icon={<Users className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard
          label="Concluídos no mês"
          value={data.monthStats.concluidos}
          icon={<Check className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Faltas no mês"
          value={data.monthStats.faltas}
          icon={<UserX className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Cancelados no mês"
          value={data.monthStats.cancelados}
          icon={<XCircle className="h-5 w-5" />}
          tone="rose"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Próximos atendimentos de hoje"
            description={`${data.weekAppointments.length} atendimento(s) nos próximos 7 dias`}
            action={
              <Link
                to="/agenda"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
              >
                Ver agenda <ChevronRight className="h-4 w-4" />
              </Link>
            }
          />
          <div className="divide-y divide-stone-100">
            {data.todayAppointments.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<Clock className="h-5 w-5" />}
                  title="Nenhum atendimento hoje"
                  description="Aproveite para entrar em contato com clientes e preencher a agenda."
                  action={
                    <Link to="/agenda/novo">
                      <Button size="sm" leftIcon={<CalendarPlus className="h-4 w-4" />}>
                        Agendar atendimento
                      </Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              data.todayAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="w-12 text-center">
                    <p className="text-sm font-semibold text-stone-900">
                      {formatTime(appointment.startsAt)}
                    </p>
                    <p className="text-[11px] text-stone-400">
                      {formatTime(appointment.endsAt)}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-900">
                      {appointment.client?.name ?? 'Cliente'}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {appointment.service?.name ?? 'Serviço'} ·{' '}
                      {appointment.professionalName || 'Sem profissional'}
                    </p>
                  </div>
                  <Badge className={APPOINTMENT_STATUS_CLASSES[appointment.status]}>
                    {APPOINTMENT_STATUS_LABELS[appointment.status]}
                  </Badge>
                  <div className="flex gap-1">
                    {appointment.status === 'agendado' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => confirmMutation.mutate(appointment.id)}
                        loading={
                          confirmMutation.isPending &&
                          confirmMutation.variables === appointment.id
                        }
                        leftIcon={<Check className="h-4 w-4" />}
                      >
                        Confirmar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => sendReminder(appointment)}
                      aria-label="Enviar lembrete pelo WhatsApp"
                    >
                      <MessageSquareText className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Aniversariantes"
              action={
                <Link to="/aniversariantes">
                  <Button size="sm" variant="ghost" rightIcon={<ChevronRight className="h-4 w-4" />}>
                    Ver
                  </Button>
                </Link>
              }
            />
            <div className="space-y-3 px-4 py-4">
              <div className="flex items-center gap-3 rounded-xl bg-brand-50 px-3 py-2.5">
                <Cake className="h-5 w-5 text-brand-700" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-brand-900">
                    {data.todayBirthdays.length} hoje
                  </p>
                  <p className="text-xs text-brand-700">
                    {data.todayBirthdays.length > 0
                      ? data.todayBirthdays.map((client) => client.name.split(' ')[0]).join(', ')
                      : 'Nenhum aniversariante hoje'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-stone-50 px-3 py-2.5">
                <Cake className="h-5 w-5 text-stone-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-900">
                    {data.monthBirthdays.length} neste mês
                  </p>
                  <p className="text-xs text-stone-500">
                    Envie mensagens de carinho pelo WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Clientes sem atendimento" />
            <div className="grid grid-cols-3 divide-x divide-stone-100">
              {[
                { days: 30, value: data.inactive.days30.length },
                { days: 60, value: data.inactive.days60.length },
                { days: 90, value: data.inactive.days90.length },
              ].map((item) => (
                <Link
                  key={item.days}
                  to={`/clientes?inativos=${item.days}`}
                  className="px-2 py-4 text-center transition hover:bg-stone-50"
                >
                  <p className="text-xl font-semibold text-stone-900">{item.value}</p>
                  <p className="text-[11px] text-stone-500">+{item.days} dias</p>
                </Link>
              ))}
            </div>
            <div className="border-t border-stone-100 px-4 py-2.5">
              <Link
                to="/clientes?inativos=30"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                Recuperar clientes inativos <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/clientes/novo">
          <Card className="flex items-center gap-3 p-4 transition hover:border-brand-200 hover:bg-brand-50/40">
            <div className="rounded-xl bg-brand-50 p-2 text-brand-700">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-900">Novo cliente</p>
              <p className="text-xs text-stone-500">Cadastre e registre o consentimento</p>
            </div>
          </Card>
        </Link>
        <Link to="/agenda/novo">
          <Card className="flex items-center gap-3 p-4 transition hover:border-brand-200 hover:bg-brand-50/40">
            <div className="rounded-xl bg-brand-50 p-2 text-brand-700">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-900">Novo agendamento</p>
              <p className="text-xs text-stone-500">Veja horários livres e ocupados</p>
            </div>
          </Card>
        </Link>
        <Link to="/mensagens">
          <Card className="flex items-center gap-3 p-4 transition hover:border-brand-200 hover:bg-brand-50/40">
            <div className="rounded-xl bg-brand-50 p-2 text-brand-700">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-900">Enviar mensagem</p>
              <p className="text-xs text-stone-500">Modelos prontos para o WhatsApp</p>
            </div>
          </Card>
        </Link>
      </div>

      <p className="text-center text-[11px] text-stone-400">
        Hoje: {toDateKey(new Date())} · Dados do seu negócio protegidos por isolamento por
        conta.
      </p>
    </div>
  )
}
