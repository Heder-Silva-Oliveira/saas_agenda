import { useQueryClient } from '@tanstack/react-query'
import {
  CalendarPlus,
  Cake,
  Check,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  ShieldCheck,
  ShieldX,
  Trash2,
  UserX,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  LoadingState,
  PageHeader,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import {
  APPOINTMENT_STATUS_CLASSES,
  APPOINTMENT_STATUS_LABELS,
  CLIENT_STATUS_LABELS,
} from '../../domain/constants'
import { useAppointments, useClients, useLogs, useServices } from '../../hooks/useData'
import {
  ageFromBirthDate,
  formatDateBR,
  formatDateTimeBR,
  formatPhoneBR,
} from '../../lib/format'
import { openWhatsApp, renderTemplate } from '../../lib/whatsapp'
import { queryKeys } from '../../lib/queryClient'
import { api } from '../../services'

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { business } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: clients, isLoading } = useClients()
  const { data: appointments = [] } = useAppointments()
  const { data: services = [] } = useServices()
  const { data: logs = [] } = useLogs()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const client = clients?.find((item) => item.id === id)

  const history = useMemo(() => {
    if (!client) return []
    return appointments
      .filter((appointment) => appointment.clientId === client.id)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
  }, [appointments, client])

  const lastVisit = history.find((appointment) => appointment.status === 'concluido')
  const nextAppointment = [...history]
    .reverse()
    .find(
      (appointment) =>
        new Date(appointment.startsAt) >= new Date() &&
        ['agendado', 'confirmado'].includes(appointment.status),
    )

  const clientLogs = useMemo(
    () => logs.filter((log) => log.clientId === id).slice(0, 5),
    [logs, id],
  )

  if (isLoading) return <LoadingState label="Carregando cliente…" />

  if (!client) {
    return (
      <EmptyState
        title="Cliente não encontrado"
        description="O cliente pode ter sido removido ou não pertence ao seu negócio."
        action={
          <Link to="/clientes">
            <Button>Voltar aos clientes</Button>
          </Link>
        }
      />
    )
  }

  const sendWhatsApp = () => {
    const message = renderTemplate(
      'Olá {{nome_cliente}}, tudo bem? Aqui é da {{nome_negocio}}.',
      {
        nome_cliente: client.name.split(' ')[0],
        nome_negocio: business?.name,
      },
    )
    openWhatsApp(client.phone, message)
    void api.logs
      .create({ clientId: client.id, messageContent: message })
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.logs }))
      .catch(() => undefined)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.clients.softDelete(client.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients })
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      toast.success('Cliente removido da lista.')
      navigate('/clientes', { replace: true })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível excluir o cliente.',
      )
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const age = ageFromBirthDate(client.birthDate)

  return (
    <div>
      <PageHeader
        title={client.name}
        description={`Cliente desde ${formatDateBR(client.createdAt)}`}
        backTo="/clientes"
        backLabel="Voltar aos clientes"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={sendWhatsApp}
              leftIcon={<MessageCircle className="h-4 w-4" />}
            >
              Enviar WhatsApp
            </Button>
            <Link to={`/clientes/${client.id}/editar`}>
              <Button variant="secondary" size="sm" leftIcon={<Pencil className="h-4 w-4" />}>
                Editar
              </Button>
            </Link>
            <Link to={`/agenda/novo?cliente=${client.id}`}>
              <Button size="sm" leftIcon={<CalendarPlus className="h-4 w-4" />}>
                Agendar
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-start gap-4 p-4 sm:p-5">
              <Avatar name={client.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-stone-900">{client.name}</h2>
                  <Badge variant={client.status === 'ativo' ? 'success' : 'neutral'}>
                    {CLIENT_STATUS_LABELS[client.status]}
                  </Badge>
                </div>
                <div className="mt-2 grid gap-2 text-sm text-stone-600 sm:grid-cols-2">
                  <a
                    href={`https://wa.me/${client.phone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 hover:text-brand-700"
                  >
                    <Phone className="h-4 w-4 text-stone-400" />
                    {formatPhoneBR(client.phone)}
                  </a>
                  {client.email ? (
                    <a
                      href={`mailto:${client.email}`}
                      className="flex items-center gap-2 hover:text-brand-700"
                    >
                      <Mail className="h-4 w-4 text-stone-400" />
                      {client.email}
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 text-stone-400">
                      <Mail className="h-4 w-4" /> Sem e-mail
                    </span>
                  )}
                  <span className="flex items-center gap-2">
                    <Cake className="h-4 w-4 text-stone-400" />
                    {client.birthDate
                      ? `${formatDateBR(client.birthDate)}${age !== null ? ` · ${age} anos` : ''}`
                      : 'Sem data de nascimento'}
                  </span>
                  <span className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-stone-400" />
                    {history.filter((item) => item.status === 'concluido').length}{' '}
                    atendimento(s) concluído(s)
                  </span>
                </div>
                {client.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {client.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {client.notes && (
              <div className="border-t border-stone-100 px-4 py-3 sm:px-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Observações
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-stone-700">
                  {client.notes}
                </p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Histórico de atendimentos"
              description={`${history.length} registro(s)`}
              action={
                <Link to={`/agenda/novo?cliente=${client.id}`}>
                  <Button size="sm" variant="outline" leftIcon={<CalendarPlus className="h-4 w-4" />}>
                    Novo
                  </Button>
                </Link>
              }
            />
            {history.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Nenhum atendimento registrado"
                  description="Crie o primeiro agendamento deste cliente."
                  action={
                    <Link to={`/agenda/novo?cliente=${client.id}`}>
                      <Button size="sm">Agendar atendimento</Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {history.map((appointment) => {
                  const service = services.find((item) => item.id === appointment.serviceId)
                  return (
                    <div
                      key={appointment.id}
                      className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-900">
                          {service?.name ?? 'Serviço'}
                          {appointment.professionalName
                            ? ` · ${appointment.professionalName}`
                            : ''}
                        </p>
                        <p className="text-xs text-stone-500">
                          {formatDateTimeBR(appointment.startsAt)}
                        </p>
                      </div>
                      <Badge className={APPOINTMENT_STATUS_CLASSES[appointment.status]}>
                        {APPOINTMENT_STATUS_LABELS[appointment.status]}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {clientLogs.length > 0 && (
            <Card>
              <CardHeader
                title="Mensagens enviadas"
                description="Últimos contatos registrados pelo WhatsApp"
              />
              <div className="divide-y divide-stone-100">
                {clientLogs.map((log) => (
                  <div key={log.id} className="px-4 py-3 sm:px-5">
                    <p className="text-xs text-stone-400">
                      {formatDateTimeBR(log.sentAt)}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-stone-700">
                      {log.messageContent}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Consentimento" />
            <div className="space-y-3 p-4 sm:p-5">
              {client.marketingConsent ? (
                <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Mensagens autorizadas</p>
                    <p className="text-xs">
                      Consentimento registrado em {formatDateBR(client.consentDate)}.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
                  <ShieldX className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Sem consentimento</p>
                    <p className="text-xs">
                      Mensagens de aniversário e retorno estão bloqueadas até o cliente
                      autorizar.
                    </p>
                  </div>
                </div>
              )}
              <Link to={`/clientes/${client.id}/editar`}>
                <Button variant="secondary" size="sm" fullWidth>
                  Atualizar consentimento
                </Button>
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Resumo" />
            <dl className="divide-y divide-stone-100 text-sm">
              <div className="flex justify-between gap-3 px-4 py-2.5 sm:px-5">
                <dt className="text-stone-500">Último atendimento</dt>
                <dd className="font-medium text-stone-800">
                  {lastVisit ? formatDateBR(lastVisit.startsAt) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3 px-4 py-2.5 sm:px-5">
                <dt className="text-stone-500">Próximo agendamento</dt>
                <dd className="text-right font-medium text-stone-800">
                  {nextAppointment ? formatDateTimeBR(nextAppointment.startsAt) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3 px-4 py-2.5 sm:px-5">
                <dt className="text-stone-500">Status</dt>
                <dd className="font-medium text-stone-800">
                  {CLIENT_STATUS_LABELS[client.status]}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
              <UserX className="h-4 w-4 text-stone-400" />
              Excluir cliente
            </p>
            <p className="mt-1 text-xs text-stone-500">
              A exclusão é lógica: o cliente sai da lista, mas o histórico é preservado
              para auditoria.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-rose-600 hover:bg-rose-50"
              onClick={() => setDeleteOpen(true)}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Excluir cliente
            </Button>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title={`Excluir ${client.name}?`}
        description="O cliente deixará de aparecer nas listas e na agenda."
        confirmLabel="Excluir cliente"
        loading={deleting}
        danger
      />
    </div>
  )
}
