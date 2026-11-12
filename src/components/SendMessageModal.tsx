import { useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { TEMPLATE_CATEGORY_LABELS } from '../domain/constants'
import { useTemplates } from '../hooks/useData'
import { formatDateBR, formatTime } from '../lib/format'
import { queryKeys } from '../lib/queryClient'
import { buildWhatsAppUrl, renderTemplate } from '../lib/whatsapp'
import { api } from '../services'
import type { Appointment, Client, Service } from '../types'
import { Button, Modal } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  client: Client
  nextAppointment?: Appointment | null
  service?: Service | null
}

export function SendMessageModal({ open, onClose, client, nextAppointment, service }: Props) {
  const { business } = useAuth()
  const queryClient = useQueryClient()
  const { data: templates = [] } = useTemplates()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const activeTemplates = templates.filter((t) => t.active)

  const selected = activeTemplates.find((t) => t.id === selectedId) ?? null

  const variables = useMemo(() => ({
    nome_cliente: client.name.split(' ')[0],
    nome_negocio: business?.name ?? '',
    data: nextAppointment ? formatDateBR(nextAppointment.startsAt) : '',
    horario: nextAppointment ? formatTime(nextAppointment.startsAt) : '',
    servico: service?.name ?? '',
    profissional: nextAppointment?.professionalName ?? '',
  }), [client, business, nextAppointment, service])

  const preview = selected ? renderTemplate(selected.body, variables) : ''

  const handleSend = async () => {
    if (!selected || !preview) return
    setSending(true)
    try {
      const url = buildWhatsAppUrl(client.phone, preview)
      window.open(url, '_blank', 'noopener,noreferrer')
      await api.logs.create({
        clientId: client.id,
        appointmentId: nextAppointment?.id ?? null,
        templateId: selected.id,
        messageContent: preview,
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.logs })
      toast.success('WhatsApp aberto e mensagem registrada.')
      onClose()
    } catch {
      toast.error('Não foi possível registrar a mensagem.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar mensagem"
      description={`Escolha um modelo para enviar para ${client.name.split(' ')[0]}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button
            disabled={!selected}
            loading={sending}
            onClick={() => void handleSend()}
            leftIcon={<Send className="h-4 w-4" />}
          >
            Abrir WhatsApp
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* template list */}
        <div className="space-y-2">
          {activeTemplates.length === 0 ? (
            <p className="text-sm text-stone-500">Nenhum modelo ativo. Crie em Mensagens.</p>
          ) : (
            activeTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedId(template.id)}
                className={[
                  'w-full rounded-xl border px-4 py-3 text-left transition',
                  selectedId === template.id
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-400/40'
                    : 'border-stone-200 bg-white hover:border-brand-300 hover:bg-brand-50/40',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-stone-900">{template.name}</p>
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                    {TEMPLATE_CATEGORY_LABELS[template.category]}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-stone-500">{template.body}</p>
              </button>
            ))
          )}
        </div>

        {/* preview */}
        {selected && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <MessageCircle className="h-3.5 w-3.5" />
              Prévia da mensagem
            </p>
            <p className="whitespace-pre-line text-sm text-emerald-900">{preview}</p>
          </div>
        )}

        {/* marketing warning */}
        {selected && ['aniversario', 'retorno'].includes(selected.category) && !client.marketingConsent && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Este cliente não autorizou mensagens de marketing. Envie apenas com consentimento registrado.
          </div>
        )}
      </div>
    </Modal>
  )
}
