import { useQueryClient } from '@tanstack/react-query'
import {
  Cake,
  CheckCircle2,
  MessageCircle,
  Pencil,
  Send,
  ShieldX,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  Textarea,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import {
  getBirthdays,
  getNextBirthday,
  type BirthdayFilter,
} from '../../domain/rules'
import { useClients, useLogs, useTemplates } from '../../hooks/useData'
import {
  ageFromBirthDate,
  formatDateBR,
  formatDateShort,
  formatPhoneBR,
  toDate,
} from '../../lib/format'
import { openWhatsApp, renderTemplate } from '../../lib/whatsapp'
import { queryKeys } from '../../lib/queryClient'
import { api } from '../../services'
import type { Client, MessageTemplate } from '../../types'

const filters: { value: BirthdayFilter; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mês' },
]

function turningAge(client: Client): number | null {
  const next = getNextBirthday(client)
  const birthDate = toDate(client.birthDate)
  if (!next || !birthDate) return null
  return next.getFullYear() - birthDate.getFullYear()
}

export function BirthdaysPage() {
  const { business } = useAuth()
  const queryClient = useQueryClient()
  const { data: clients = [], isLoading, isError, error, refetch } = useClients()
  const { data: templates = [] } = useTemplates()
  const { data: logs = [] } = useLogs()
  const [filter, setFilter] = useState<BirthdayFilter>('hoje')
  const [selected, setSelected] = useState<Client | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const birthdayTemplate = useMemo(
    () => templates.find((template) => template.category === 'aniversario'),
    [templates],
  )

  const birthdayTemplateIds = useMemo(
    () =>
      new Set(
        templates
          .filter((template) => template.category === 'aniversario')
          .map((template) => template.id),
      ),
    [templates],
  )

  const sentThisYear = useMemo(() => {
    const map = new Map<string, string>()
    const year = new Date().getFullYear()
    logs.forEach((log) => {
      const date = toDate(log.sentAt)
      if (
        date &&
        date.getFullYear() === year &&
        log.templateId &&
        birthdayTemplateIds.has(log.templateId) &&
        !map.has(log.clientId)
      ) {
        map.set(log.clientId, log.sentAt)
      }
    })
    return map
  }, [logs, birthdayTemplateIds])

  const list = useMemo(
    () => getBirthdays(clients, filter).filter((client) => !client.deletedAt),
    [clients, filter],
  )

  const counts = useMemo(
    () => ({
      hoje: getBirthdays(clients, 'hoje').length,
      semana: getBirthdays(clients, 'semana').length,
      mes: getBirthdays(clients, 'mes').length,
    }),
    [clients],
  )

  const openSend = (client: Client, template?: MessageTemplate) => {
    const body =
      template?.body ??
      'Feliz aniversário, {{nome_cliente}}! A equipe da {{nome_negocio}} deseja um dia especial.'
    setMessage(
      renderTemplate(body, {
        nome_cliente: client.name.split(' ')[0],
        nome_negocio: business?.name,
      }),
    )
    setSelected(client)
  }

  const handleSend = async () => {
    if (!selected) return
    if (!selected.marketingConsent) {
      toast.error('Este cliente não autorizou receber mensagens de marketing.')
      return
    }
    setSending(true)
    try {
      openWhatsApp(selected.phone, message)
      await api.logs.create({
        clientId: selected.id,
        templateId: birthdayTemplate?.id ?? null,
        messageContent: message,
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.logs })
      toast.success('Mensagem aberta no WhatsApp e envio registrado.')
      setSelected(null)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'A mensagem foi aberta, mas não foi possível registrar o envio.',
      )
    } finally {
      setSending(false)
    }
  }

  if (isLoading) return <LoadingState label="Carregando aniversariantes…" />
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Erro ao carregar aniversariantes.'}
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
            Aniversariantes
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Envie uma mensagem de carinho pelo WhatsApp e registre o contato.
          </p>
        </div>
        <Link to="/mensagens">
          <Button variant="secondary" size="sm" leftIcon={<Pencil className="h-4 w-4" />}>
            Editar modelo
          </Button>
        </Link>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                filter === item.value
                  ? 'bg-brand-700 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {item.label}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  filter === item.value
                    ? 'bg-white/20 text-white'
                    : 'bg-white text-stone-500'
                }`}
              >
                {counts[item.value]}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {list.length === 0 ? (
        <EmptyState
          icon={<Cake className="h-5 w-5" />}
          title={
            filter === 'hoje'
              ? 'Nenhum aniversariante hoje'
              : filter === 'semana'
                ? 'Nenhum aniversariante nos próximos 7 dias'
                : 'Nenhum aniversariante neste mês'
          }
          description="Cadastre a data de nascimento dos clientes para acompanhar aqui."
          action={
            <Link to="/clientes">
              <Button size="sm">Ver clientes</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {list.map((client) => {
            const sentAt = sentThisYear.get(client.id)
            const isToday =
              client.birthDate &&
              getBirthdays([client], 'hoje').length > 0
            const age = turningAge(client)
            const currentAge = ageFromBirthDate(client.birthDate)
            return (
              <Card
                key={client.id}
                className={`flex flex-wrap items-center gap-3 p-3 sm:p-4 ${
                  isToday ? 'border-brand-200 bg-brand-50/40' : ''
                }`}
              >
                <Avatar name={client.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/clientes/${client.id}`}
                      className="truncate text-sm font-semibold text-stone-900 hover:text-brand-700"
                    >
                      {client.name}
                    </Link>
                    {isToday && <Badge variant="brand">Aniversariante do dia</Badge>}
                    {sentAt && (
                      <Badge variant="success">
                        <CheckCircle2 className="h-3 w-3" />
                        Enviada em {formatDateBR(sentAt)}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {formatDateBR(client.birthDate)}
                    {currentAge !== null ? ` · ${currentAge} anos` : ''}
                    {age !== null && age !== currentAge ? ` · completa ${age}` : ''}
                    {' · '}
                    {formatPhoneBR(client.phone)}
                  </p>
                  {!client.marketingConsent && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-700">
                      <ShieldX className="h-3 w-3" />
                      Sem consentimento para mensagens de marketing
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Link to={`/clientes/${client.id}/editar`}>
                    <Button size="sm" variant="ghost" aria-label="Editar consentimento">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant={client.marketingConsent ? 'primary' : 'secondary'}
                    disabled={!client.marketingConsent}
                    onClick={() => openSend(client, birthdayTemplate)}
                    leftIcon={<MessageCircle className="h-4 w-4" />}
                  >
                    Enviar mensagem
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white p-3 text-xs text-stone-500">
        <p className="font-medium text-stone-700">Sobre o envio</p>
        <p className="mt-0.5">
          A mensagem é aberta no WhatsApp com o texto preenchido. O Controlativa não
          envia mensagens automáticas em massa. Mensagens de aniversário são consideradas
          marketing e exigem consentimento registrado.
        </p>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={
          selected
            ? `Mensagem para ${selected.name.split(' ')[0]}`
            : 'Mensagem de aniversário'
        }
        description={
          selected?.birthDate
            ? `Aniversário em ${formatDateShort(selected.birthDate)}`
            : undefined
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)} disabled={sending}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSend()}
              loading={sending}
              disabled={!selected?.marketingConsent || !message.trim()}
              leftIcon={<Send className="h-4 w-4" />}
            >
              Abrir WhatsApp e registrar
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-3">
            {!selected.marketingConsent && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
                <ShieldX className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Consentimento necessário</p>
                  <p className="text-xs">
                    Registre a autorização do cliente antes de enviar mensagens de
                    aniversário.{' '}
                    <Link
                      to={`/clientes/${selected.id}/editar`}
                      className="font-semibold underline"
                    >
                      Atualizar cliente
                    </Link>
                  </p>
                </div>
              </div>
            )}
            <Textarea
              label="Mensagem"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              hint="Você pode editar livremente. O modelo principal fica em Modelos de mensagem."
            />
            <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-500">
              <p className="font-medium text-stone-700">Prévia</p>
              <p className="mt-1 whitespace-pre-line">{message}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
