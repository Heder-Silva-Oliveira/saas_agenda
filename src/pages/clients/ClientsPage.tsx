import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronRight,
  Download,
  MessageCircle,
  Search,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  ListSkeleton,
  Select,
} from '../../components/ui'
import { CLIENT_STATUS_LABELS } from '../../domain/constants'
import { filterInactiveClients, getLastVisitMap } from '../../domain/rules'
import { useAppointments, useClients } from '../../hooks/useData'
import { clientsToCsv, downloadCsv } from '../../lib/csv'
import { formatDateBR, formatPhoneBR } from '../../lib/format'
import { queryKeys } from '../../lib/queryClient'
import type { ImportResult } from '../../types'
import { ImportClientsModal } from './ImportClientsModal'

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function ClientsPage() {
  const { data: clients, isLoading, isError, error, refetch } = useClients()
  const { data: appointments = [] } = useAppointments()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [importOpen, setImportOpen] = useState(false)
  const queryClient = useQueryClient()

  const inactiveParam = Number(searchParams.get('inativos') ?? 0)
  const inactiveDays = [30, 60, 90].includes(inactiveParam) ? inactiveParam : 0

  const lastVisits = useMemo(() => getLastVisitMap(appointments), [appointments])

  const baseClients = useMemo(() => {
    if (!clients) return []
    if (inactiveDays > 0) {
      return filterInactiveClients(clients, appointments, inactiveDays)
    }
    return clients
  }, [clients, appointments, inactiveDays])

  const filtered = useMemo(() => {
    const term = normalize(search.trim())
    return baseClients
      .filter((client) => (status === 'todos' ? true : client.status === status))
      .filter((client) => {
        if (!term) return true
        return (
          normalize(client.name).includes(term) ||
          client.phone.includes(term.replace(/\D/g, '')) ||
          normalize(client.email ?? '').includes(term) ||
          client.tags.some((tag) => normalize(tag).includes(term))
        )
      })
  }, [baseClients, search, status])

  const importMutation = useMutation({
    mutationFn: async () => undefined,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
    },
  })

  const handleImported = (result: ImportResult) => {
    importMutation.mutate()
    if (result.imported > 0) {
      toast.success(`${result.imported} cliente(s) adicionado(s) à lista.`)
    }
  }

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error('Nenhum cliente para exportar.')
      return
    }
    downloadCsv('clientes.csv', clientsToCsv(filtered))
    toast.success('Exportação iniciada.')
  }

  const clearInactiveFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('inativos')
    setSearchParams(next)
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Erro ao carregar clientes.'}
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {clients ? `${clients.length} cliente(s) cadastrado(s)` : 'Carregando…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setImportOpen(true)}
            leftIcon={<Upload className="h-4 w-4" />}
          >
            Importar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            leftIcon={<Download className="h-4 w-4" />}
          >
            Exportar
          </Button>
          <Link to="/clientes/novo">
            <Button size="sm" leftIcon={<UserPlus className="h-4 w-4" />}>
              Novo cliente
            </Button>
          </Link>
        </div>
      </div>

      {inactiveDays > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <p>
            Mostrando clientes sem atendimento há mais de <strong>{inactiveDays} dias</strong>.
          </p>
          <button
            type="button"
            onClick={clearInactiveFilter}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold hover:bg-amber-100"
          >
            <X className="h-3.5 w-3.5" />
            Limpar filtro
          </button>
        </div>
      )}

      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nome, telefone, e-mail ou tag…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="sm:w-44">
            <Select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as 'todos' | 'ativo' | 'inativo')
              }
            >
              <option value="todos">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </Select>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={clients && clients.length > 0 ? 'Nenhum cliente encontrado' : 'Sua lista está vazia'}
          description={
            clients && clients.length > 0
              ? 'Tente ajustar a busca ou os filtros aplicados.'
              : 'Cadastre seu primeiro cliente ou importe uma planilha CSV.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/clientes/novo">
                <Button size="sm" leftIcon={<UserPlus className="h-4 w-4" />}>
                  Novo cliente
                </Button>
              </Link>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setImportOpen(true)}
                leftIcon={<Upload className="h-4 w-4" />}
              >
                Importar CSV
              </Button>
            </div>
          }
        />
      ) : (
        <Card className="divide-y divide-stone-100 overflow-hidden">
          {filtered.map((client) => {
            const lastVisit = lastVisits.get(client.id)
            return (
              <Link
                key={client.id}
                to={`/clientes/${client.id}`}
                className="flex items-center gap-3 px-3 py-3 transition hover:bg-stone-50 sm:px-4"
              >
                <Avatar name={client.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-stone-900">
                      {client.name}
                    </p>
                    <Badge
                      variant={client.status === 'ativo' ? 'success' : 'neutral'}
                    >
                      {CLIENT_STATUS_LABELS[client.status]}
                    </Badge>
                    {client.marketingConsent ? (
                      <span
                        title="Consentimento para receber mensagens"
                        className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600"
                      >
                        <MessageCircle className="h-3 w-3" /> consentiu
                      </span>
                    ) : (
                      <span
                        title="Sem consentimento para mensagens de marketing"
                        className="text-[11px] font-medium text-stone-400"
                      >
                        sem consentimento
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500">
                    <span>{formatPhoneBR(client.phone)}</span>
                    {client.email && <span className="truncate">· {client.email}</span>}
                    {client.birthDate && <span>· Nasc. {formatDateBR(client.birthDate)}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {client.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600"
                      >
                        {tag}
                      </span>
                    ))}
                    <span className="text-[11px] text-stone-400">
                      {lastVisit
                        ? `Último atendimento: ${formatDateBR(lastVisit)}`
                        : 'Sem atendimentos'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
              </Link>
            )
          })}
        </Card>
      )}

      <ImportClientsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
      />
    </div>
  )
}

