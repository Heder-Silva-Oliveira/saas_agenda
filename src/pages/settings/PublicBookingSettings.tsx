import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, ExternalLink, Link2, MessageCircle, Save, ToggleLeft, ToggleRight } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button, Card, CardHeader, Input } from '../../components/ui'
import { PUBLIC_BOOKING_PATH } from '../../config'
import { useAuth } from '../../context/AuthContext'
import { queryKeys } from '../../lib/queryClient'
import { api } from '../../services'

const slugSchema = z.object({
  slug: z
    .string()
    .min(2, 'Mínimo 2 caracteres.')
    .max(80, 'Máximo 80 caracteres.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use apenas letras minúsculas, números e hífens.'),
})

type SlugValues = z.infer<typeof slugSchema>

export function PublicBookingSettings() {
  const { business, applyBusiness } = useAuth()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [toggling, setToggling] = useState(false)

  const publicUrl = business?.slug
    ? `${window.location.origin}${PUBLIC_BOOKING_PATH}/${business.slug}`
    : ''

  const whatsappText = encodeURIComponent(
    `Agende seu horário online: ${publicUrl}`,
  )
  const whatsappShareUrl = `https://wa.me/?text=${whatsappText}`

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SlugValues>({
    resolver: zodResolver(slugSchema),
    defaultValues: { slug: business?.slug ?? '' },
  })

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Link copiado!')
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  const toggleEnabled = async () => {
    if (!business) return
    setToggling(true)
    try {
      const updated = await api.business.update({
        name: business.name,
        slug: business.slug,
        segment: business.segment,
        whatsappNumber: business.whatsappNumber,
        openingHours: business.openingHours,
        logoUrl: business.logoUrl,
        publicBookingEnabled: !business.publicBookingEnabled,
      })
      applyBusiness(updated)
      void queryClient.invalidateQueries({ queryKey: queryKeys.business })
      toast.success(
        updated.publicBookingEnabled
          ? 'Agenda online ativada.'
          : 'Agenda online desativada.',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar.')
    } finally {
      setToggling(false)
    }
  }

  const saveSlug = handleSubmit(async (values) => {
    if (!business) return
    try {
      const updated = await api.business.update({
        name: business.name,
        slug: values.slug,
        segment: business.segment,
        whatsappNumber: business.whatsappNumber,
        openingHours: business.openingHours,
        logoUrl: business.logoUrl,
        publicBookingEnabled: business.publicBookingEnabled,
      })
      applyBusiness(updated)
      void queryClient.invalidateQueries({ queryKey: queryKeys.business })
      toast.success('Link atualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.')
    }
  })

  if (!business) return null

  return (
    <Card>
      <CardHeader
        title="Agenda online pública"
        description="Clientes agendam sem precisar criar conta."
        action={
          <button
            onClick={() => void toggleEnabled()}
            disabled={toggling}
            className="flex items-center gap-1.5 text-sm font-medium transition disabled:opacity-50"
            aria-label={business.publicBookingEnabled ? 'Desativar agenda online' : 'Ativar agenda online'}
          >
            {business.publicBookingEnabled ? (
              <>
                <ToggleRight className="h-5 w-5 text-brand-600" />
                <span className="text-brand-700">Ativa</span>
              </>
            ) : (
              <>
                <ToggleLeft className="h-5 w-5 text-stone-400" />
                <span className="text-stone-500">Inativa</span>
              </>
            )}
          </button>
        }
      />

      <div className="space-y-4 p-4 sm:p-5">
        {/* link display */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-stone-700">Seu link público</p>
          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5">
              <Link2 className="h-4 w-4 shrink-0 text-stone-400" />
              <span className="truncate text-sm text-stone-600">{publicUrl}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void copyLink()}
              leftIcon={
                copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )
              }
              aria-label="Copiar link"
            >
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>

        {/* actions */}
        <div className="flex flex-wrap gap-2">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 transition"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir página
          </a>
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 transition"
          >
            <MessageCircle className="h-4 w-4" />
            Compartilhar no WhatsApp
          </a>
        </div>

        {/* slug editor */}
        <form onSubmit={(e) => void saveSlug(e)} className="space-y-3 border-t border-stone-100 pt-4">
          <Input
            label="Personalizar link"
            hint="Use letras minúsculas, números e hífens. Ex: barbearia-do-joao"
            placeholder="meu-negocio"
            error={errors.slug?.message}
            {...register('slug')}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={isSubmitting}
              leftIcon={<Save className="h-4 w-4" />}
            >
              Salvar link
            </Button>
          </div>
        </form>
      </div>
    </Card>
  )
}
