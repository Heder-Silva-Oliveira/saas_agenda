import { zodResolver } from '@hookform/resolvers/zod'
import { MessageCircle, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import {
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
import { useAuth } from '../../context/AuthContext'
import { useClients } from '../../hooks/useData'
import { formatDateBR, normalizePhoneBR, onlyDigits } from '../../lib/format'
import { queryKeys } from '../../lib/queryClient'
import { api } from '../../services'
import type { Client, ClientInput } from '../../types'
import { useQueryClient } from '@tanstack/react-query'

const schema = z.object({
  name: z.string().min(2, 'Informe o nome do cliente.'),
  phone: z
    .string()
    .min(1, 'Informe o telefone/WhatsApp.')
    .refine((value) => {
      const digits = onlyDigits(value)
      return digits.length >= 10 && digits.length <= 13
    }, 'Informe DDD + número, por exemplo (11) 98765-4321.'),
  email: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      'E-mail inválido.',
    ),
  birthDate: z
    .string()
    .optional()
    .refine((value) => {
      if (!value) return true
      const date = new Date(`${value}T00:00:00`)
      return !Number.isNaN(date.getTime()) && date <= new Date()
    }, 'Informe uma data de nascimento válida.'),
  notes: z.string().optional(),
  tags: z.string().optional(),
  status: z.enum(['ativo', 'inativo']),
  marketingConsent: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function ClientForm({ client }: { client?: Client }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { business } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: client?.name ?? '',
      phone: client?.phone ?? '',
      email: client?.email ?? '',
      birthDate: client?.birthDate ?? '',
      notes: client?.notes ?? '',
      tags: client?.tags.join(', ') ?? '',
      status: client?.status ?? 'ativo',
      marketingConsent: client?.marketingConsent ?? false,
    },
  })

  const consent = watch('marketingConsent')

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    const payload: ClientInput = {
      name: values.name.trim(),
      phone: normalizePhoneBR(values.phone),
      email: values.email?.trim() || null,
      birthDate: values.birthDate || null,
      notes: values.notes?.trim() || null,
      tags: (values.tags ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      status: values.status,
      marketingConsent: values.marketingConsent,
      consentDate: client?.consentDate ?? null,
    }

    try {
      if (client) {
        const updated = await api.clients.update(client.id, payload)
        await queryClient.invalidateQueries({ queryKey: queryKeys.clients })
        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
        toast.success('Cliente atualizado.')
        navigate(`/clientes/${updated.id}`)
      } else {
        const created = await api.clients.create(payload)
        await queryClient.invalidateQueries({ queryKey: queryKeys.clients })
        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
        toast.success('Cliente cadastrado.')
        navigate(`/clientes/${created.id}`)
      }
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Não foi possível salvar o cliente.',
      )
    }
  })

  return (
    <div>
      <PageHeader
        title={client ? 'Editar cliente' : 'Novo cliente'}
        description={
          client
            ? 'Atualize os dados e o consentimento de mensagens.'
            : 'Cadastre o cliente para agendar atendimentos e enviar mensagens.'
        }
        backTo={client ? `/clientes/${client.id}` : '/clientes'}
        backLabel={client ? 'Voltar ao cliente' : 'Voltar aos clientes'}
      />

      <form onSubmit={onSubmit} className="space-y-4">
        <Card>
          <CardHeader title="Dados do cliente" />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Input
              label="Nome completo"
              placeholder="Maria Silva"
              required
              containerClassName="sm:col-span-2"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Telefone / WhatsApp"
              placeholder="(11) 98765-4321"
              inputMode="tel"
              required
              hint="Usado para abrir o WhatsApp com mensagens prontas."
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Input
              label="E-mail (opcional)"
              type="email"
              placeholder="cliente@email.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Data de nascimento (opcional)"
              type="date"
              error={errors.birthDate?.message}
              {...register('birthDate')}
            />
            <Select label="Status" {...register('status')}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </Select>
            <Input
              label="Tags (opcional)"
              placeholder="vip, cabelo, recorrente"
              hint="Separe as tags por vírgula."
              containerClassName="sm:col-span-2"
              {...register('tags')}
            />
            <Textarea
              label="Observações (opcional)"
              placeholder="Preferências, alergias, histórico importante…"
              containerClassName="sm:col-span-2"
              {...register('notes')}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Consentimento para mensagens"
            description="Registre a autorização do cliente para receber mensagens de marketing."
          />
          <div className="space-y-3 p-4 sm:p-5">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                {...register('marketingConsent')}
              />
              <span className="text-sm text-stone-700">
                O cliente autorizou receber mensagens de aniversário, retorno e
                novidades pelo WhatsApp.
                <span className="mt-0.5 block text-xs text-stone-500">
                  Sem esse consentimento, mensagens de marketing ficam bloqueadas. A
                  autorização pode ser revogada a qualquer momento desmarcando a opção.
                </span>
              </span>
            </label>

            {client?.consentDate && consent && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Consentimento registrado em {formatDateBR(client.consentDate)}.
              </p>
            )}

            <div className="flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-xs text-brand-800">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                O envio é sempre manual: abrimos o WhatsApp com a mensagem preenchida.
                Nenhuma mensagem automática em massa é enviada pelo Controlativa.
              </p>
            </div>

            {business?.whatsappNumber && (
              <p className="text-xs text-stone-500">
                O número do negócio usado nas mensagens é {business.whatsappNumber}.
              </p>
            )}
          </div>
        </Card>

        {serverError && (
          <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
            {serverError}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link to={client ? `/clientes/${client.id}` : '/clientes'}>
            <Button variant="secondary" fullWidth>
              Cancelar
            </Button>
          </Link>
          <Button type="submit" loading={isSubmitting} size="lg">
            {client ? 'Salvar alterações' : 'Cadastrar cliente'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export function ClientFormPage() {
  const { id } = useParams<{ id: string }>()
  const { data: clients, isLoading } = useClients()

  if (!id) return <ClientForm />

  if (isLoading) return <LoadingState label="Carregando cliente…" />

  const client = clients?.find((item) => item.id === id)
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

  return <ClientForm key={client.id} client={client} />
}
