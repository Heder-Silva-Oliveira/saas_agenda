import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Clock, Pencil, Plus, Save, Scissors, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { LogoUploader } from '../../components/LogoUploader'
import { PublicBookingSettings } from './PublicBookingSettings'
import { OpeningHoursEditor } from '../../components/OpeningHoursEditor'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  Modal,
  Select,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import {
  DEFAULT_OPENING_HOURS,
  SEGMENTS,
  SEGMENT_LABELS,
} from '../../domain/constants'
import { useServices } from '../../hooks/useData'
import {
  formatCurrency,
  formatDuration,
  normalizePhoneBR,
  onlyDigits,
  parseCurrencyBR,
} from '../../lib/format'
import { queryKeys } from '../../lib/queryClient'
import { api } from '../../services'
import type { OpeningHours, Service } from '../../types'

const businessSchema = z.object({
  name: z.string().min(2, 'Informe o nome do negócio.'),
  segment: z.enum([
    'barbearia',
    'salao',
    'estetica',
    'lash',
    'personal',
    'petshop',
    'outro',
  ]),
  segmentCustom: z.string().max(60, 'Máximo 60 caracteres.').optional(),
  whatsappNumber: z
    .string()
    .min(1, 'Informe o WhatsApp do negócio.')
    .refine((value) => {
      const digits = onlyDigits(value)
      return digits.length >= 10 && digits.length <= 13
    }, 'Informe DDD + número.'),
})

type BusinessValues = z.infer<typeof businessSchema>

const serviceSchema = z.object({
  name: z.string().min(2, 'Informe o nome do serviço.'),
  durationMinutes: z
    .string()
    .min(1, 'Informe a duração.')
    .refine(
      (value) => Number(value) >= 5 && Number(value) <= 600,
      'Duração entre 5 e 600 minutos.',
    ),
  price: z
    .string()
    .min(1, 'Informe o valor.')
    .refine((value) => parseCurrencyBR(value) >= 0, 'Valor inválido.'),
  active: z.boolean(),
})

type ServiceValues = z.infer<typeof serviceSchema>

function ServiceModal({
  open,
  service,
  onClose,
  onSaved,
}: {
  open: boolean
  service: Service | null
  onClose: () => void
  onSaved: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name ?? '',
      durationMinutes: String(service?.durationMinutes ?? 60),
      price: String(service?.price ?? 0),
      active: service?.active ?? true,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const payload = {
        name: values.name.trim(),
        durationMinutes: Number(values.durationMinutes),
        price: parseCurrencyBR(values.price),
        active: values.active,
      }
      if (service) await api.services.update(service.id, payload)
      else await api.services.create(payload)
      toast.success(service ? 'Serviço atualizado.' : 'Serviço criado.')
      onSaved()
      onClose()
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Não foi possível salvar o serviço.',
      )
    }
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={service ? 'Editar serviço' : 'Novo serviço'}
      description="Serviços aparecem na criação de agendamentos."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => void onSubmit()}
            loading={isSubmitting}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Salvar
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Input
          label="Nome do serviço"
          placeholder="Corte masculino"
          required
          error={errors.name?.message}
          {...register('name')}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Duração (minutos)"
            type="number"
            min={5}
            step={5}
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
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
            {...register('active')}
          />
          Serviço ativo
        </label>
        {serverError && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  )
}

function BusinessSettings() {
  const { business, applyBusiness } = useAuth()
  const [logoUrl, setLogoUrl] = useState<string | null>(business?.logoUrl ?? null)
  const [openingHours, setOpeningHours] = useState<OpeningHours>({
    ...DEFAULT_OPENING_HOURS,
    ...(business?.openingHours ?? {}),
  })
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BusinessValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: business?.name ?? '',
      segment: business?.segment ?? 'outro',
      segmentCustom: business?.segmentCustom ?? '',
      whatsappNumber: business?.whatsappNumber ?? '',
    },
  })

  const watchedSegment = watch('segment')

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    setSaving(true)
    try {
      const updated = await api.business.update({
        name: values.name,
        segment: values.segment,
        segmentCustom: values.segment === 'outro' ? values.segmentCustom ?? null : null,
        whatsappNumber: normalizePhoneBR(values.whatsappNumber),
        openingHours,
        logoUrl,
        onboardingCompleted: true,
      })
      applyBusiness(updated)
      toast.success('Configurações salvas.')
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Não foi possível salvar.',
      )
    } finally {
      setSaving(false)
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader
          title="Dados do negócio"
          description="Essas informações aparecem nas mensagens enviadas."
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <Input
            label="Nome do negócio"
            required
            containerClassName="sm:col-span-2"
            error={errors.name?.message}
            {...register('name')}
          />
          <div className="space-y-2">
            <Select label="Segmento" {...register('segment')}>
              {SEGMENTS.map((segment) => (
                <option key={segment.value} value={segment.value}>
                  {segment.label}
                </option>
              ))}
            </Select>
            {watchedSegment === 'outro' && (
              <Input
                placeholder="Descreva seu segmento"
                hint="Ex: Clínica veterinária, Estúdio de tatuagem…"
                error={errors.segmentCustom?.message}
                {...register('segmentCustom')}
              />
            )}
          </div>
          <Input
            label="WhatsApp do negócio"
            placeholder="(11) 98765-4321"
            inputMode="tel"
            required
            error={errors.whatsappNumber?.message}
            {...register('whatsappNumber')}
          />
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium text-stone-700">Logo</p>
            <LogoUploader
              value={logoUrl}
              name={business?.name ?? 'Negócio'}
              onChange={setLogoUrl}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Horário de funcionamento"
          description="Usado para calcular horários livres na agenda."
          action={<Clock className="h-5 w-5 text-stone-400" />}
        />
        <div className="p-4 sm:p-5">
          <OpeningHoursEditor value={openingHours} onChange={setOpeningHours} />
        </div>
      </Card>

      {serverError && (
        <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          {serverError}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          loading={saving}
          leftIcon={<Save className="h-4 w-4" />}
        >
          Salvar configurações
        </Button>
      </div>
    </form>
  )
}

function ServicesSettings() {
  const queryClient = useQueryClient()
  const { data: services = [], isLoading } = useServices()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.services })
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
  }

  const deactivate = async (service: Service) => {
    try {
      await api.services.deactivate(service.id)
      refresh()
      toast.success('Serviço desativado.')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível desativar.',
      )
    }
  }

  return (
    <Card>
      <CardHeader
        title="Serviços"
        description="Cadastre os serviços usados nos agendamentos."
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Novo serviço
          </Button>
        }
      />
      {isLoading ? (
        <div className="p-4 text-sm text-stone-500">Carregando serviços…</div>
      ) : services.length === 0 ? (
        <div className="p-4 text-sm text-stone-500">
          Nenhum serviço cadastrado. Crie o primeiro para agilizar os agendamentos.
        </div>
      ) : (
        <div className="divide-y divide-stone-100">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
                <Scissors className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-stone-900">{service.name}</p>
                  {!service.active && <Badge variant="neutral">Inativo</Badge>}
                </div>
                <p className="text-xs text-stone-500">
                  {formatDuration(service.durationMinutes)} ·{' '}
                  {formatCurrency(service.price)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(service)
                    setModalOpen(true)
                  }}
                  leftIcon={<Pencil className="h-4 w-4" />}
                >
                  Editar
                </Button>
                {service.active && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-600 hover:bg-rose-50"
                    onClick={() => void deactivate(service)}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    Desativar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <ServiceModal
          key={editing?.id ?? 'new'}
          open={modalOpen}
          service={editing}
          onClose={() => setModalOpen(false)}
          onSaved={refresh}
        />
      )}
    </Card>
  )
}

export function SettingsPage() {
  const { business } = useAuth()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {business
            ? `${business.name} · ${business.segment === 'outro' && business.segmentCustom ? business.segmentCustom : SEGMENT_LABELS[business.segment]}`
            : 'Dados do negócio, horários e serviços.'}
        </p>
      </div>

      {business && <BusinessSettings key={business.id} />}
      <ServicesSettings />
      <PublicBookingSettings />
    </div>
  )
}
