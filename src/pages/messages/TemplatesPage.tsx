import { useQueryClient } from '@tanstack/react-query'
import { Info, Pencil, RotateCcw, Save, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
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
  DEFAULT_TEMPLATES,
  TEMPLATE_CATEGORY_DESCRIPTIONS,
  TEMPLATE_CATEGORY_LABELS,
} from '../../domain/constants'
import { useTemplates } from '../../hooks/useData'
import { renderTemplate, TEMPLATE_VARIABLES } from '../../lib/whatsapp'
import { queryKeys } from '../../lib/queryClient'
import { api } from '../../services'
import type { MessageTemplate } from '../../types'

const sampleVariables = {
  nome_cliente: 'Maria',
  nome_negocio: 'Seu negócio',
  data: '15/03',
  horario: '14:00',
  servico: 'Corte',
  profissional: 'Rafael',
}

export function TemplatesPage() {
  const { business } = useAuth()
  const queryClient = useQueryClient()
  const { data: templates = [], isLoading, isError, error, refetch } = useTemplates()
  const [editing, setEditing] = useState<MessageTemplate | null>(null)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const sorted = useMemo(
    () =>
      [...templates].sort((a, b) =>
        TEMPLATE_CATEGORY_LABELS[a.category].localeCompare(
          TEMPLATE_CATEGORY_LABELS[b.category],
          'pt-BR',
        ),
      ),
    [templates],
  )

  const openEdit = (template: MessageTemplate) => {
    setEditing(template)
    setName(template.name)
    setBody(template.body)
    setActive(template.active)
  }

  const appendVariable = (variable: string) => {
    setBody((current) => `${current}${current.endsWith(' ') || current === '' ? '' : ' '}{{${variable}}}`)
  }

  const restoreDefault = () => {
    if (!editing) return
    const defaultTemplate = DEFAULT_TEMPLATES.find(
      (template) => template.category === editing.category,
    )
    if (defaultTemplate) {
      setName(defaultTemplate.name)
      setBody(defaultTemplate.body)
      toast.info('Modelo padrão restaurado. Salve para confirmar.')
    }
  }

  const save = async () => {
    if (!editing) return
    if (!body.trim()) {
      toast.error('A mensagem não pode ficar vazia.')
      return
    }
    setSaving(true)
    try {
      await api.templates.update(editing.id, {
        name: name.trim() || editing.name,
        body: body.trim(),
        active,
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.templates })
      toast.success('Modelo atualizado.')
      setEditing(null)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Não foi possível salvar o modelo.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <LoadingState label="Carregando modelos…" />
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Erro ao carregar modelos.'}
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
          Modelos de mensagem
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Personalize os textos usados nos atalhos de WhatsApp. O envio é sempre manual.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm text-brand-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Mensagens de marketing (aniversário e retorno) só são liberadas para clientes
          com consentimento registrado. Nenhum envio automático em massa é feito pelo
          Controlativa.
        </p>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="Nenhum modelo encontrado"
          description="Os modelos padrão são criados junto com o seu negócio."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {sorted.map((template) => (
            <Card key={template.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-stone-900">
                      {TEMPLATE_CATEGORY_LABELS[template.category]}
                    </h2>
                    <Badge variant={template.active ? 'success' : 'neutral'}>
                      {template.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {TEMPLATE_CATEGORY_DESCRIPTIONS[template.category]}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEdit(template)}
                  leftIcon={<Pencil className="h-4 w-4" />}
                >
                  Editar
                </Button>
              </div>

              <div className="mt-3 flex-1 rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
                <p className="whitespace-pre-line">{template.body}</p>
              </div>

              <div className="mt-3 rounded-xl border border-dashed border-stone-200 p-2 text-xs text-stone-500">
                <p className="flex items-center gap-1 font-medium text-stone-600">
                  <Info className="h-3.5 w-3.5" />
                  Prévia
                </p>
                <p className="mt-1 whitespace-pre-line">
                  {renderTemplate(template.body, {
                    ...sampleVariables,
                    nome_negocio: business?.name ?? sampleVariables.nome_negocio,
                  })}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-stone-900">Variáveis disponíveis</h2>
        <p className="mt-0.5 text-xs text-stone-500">
          Use as variáveis abaixo nos textos. Elas são preenchidas no momento do envio.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TEMPLATE_VARIABLES.map((variable) => (
            <code
              key={variable.key}
              className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700"
            >
              {'{{'}
              {variable.key}
              {'}}'}
            </code>
          ))}
        </div>
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={
          editing ? TEMPLATE_CATEGORY_LABELS[editing.category] : 'Editar modelo'
        }
        description="Personalize o texto e salve. As variáveis serão substituídas no envio."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditing(null)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void save()}
              loading={saving}
              leftIcon={<Save className="h-4 w-4" />}
            >
              Salvar modelo
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-stone-700">Nome</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-11 w-full rounded-xl border border-stone-300 px-3.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </label>
              <label className="flex items-end gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) => setActive(event.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-stone-700">Modelo ativo</span>
              </label>
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap gap-1">
                {TEMPLATE_VARIABLES.map((variable) => (
                  <button
                    key={variable.key}
                    type="button"
                    onClick={() => appendVariable(variable.key)}
                    className="rounded-lg bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-600 transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    + {variable.label}
                  </button>
                ))}
              </div>
              <Textarea
                label="Mensagem"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={6}
              />
            </div>

            <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-500">
              <p className="font-medium text-stone-700">Prévia</p>
              <p className="mt-1 whitespace-pre-line">
                {renderTemplate(body, {
                  ...sampleVariables,
                  nome_negocio: business?.name ?? sampleVariables.nome_negocio,
                })}
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={restoreDefault}
              leftIcon={<RotateCcw className="h-4 w-4" />}
            >
              Restaurar texto padrão
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
