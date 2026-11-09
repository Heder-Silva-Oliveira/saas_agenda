import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight, Clock, User } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button, Input } from '../../components/ui'
import { BOOKING_MAX_DAYS } from '../../config'
import { cn, formatCurrency, formatDuration, normalizePhoneBR, onlyDigits } from '../../lib/format'
import { api } from '../../services'
import type { PublicBookingInput, PublicBusinessInfo, PublicSlot } from '../../types'

// ─── helpers ────────────────────────────────────────────────────────────────

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function formatDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`)
  return format(date, "EEEE, d 'de' MMMM", { locale: ptBR })
}

const today = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// ─── step types ─────────────────────────────────────────────────────────────

type Step = 'service' | 'professional' | 'date' | 'time' | 'form' | 'done'

interface BookingState {
  serviceId: string
  serviceName: string
  durationMinutes: number
  price: number
  professionalId: string | null
  professionalName: string
  dateKey: string
  slot: PublicSlot | null
}

// ─── contact form schema ─────────────────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(2, 'Informe seu nome completo.'),
  phone: z.string().refine((v) => {
    const d = onlyDigits(normalizePhoneBR(v))
    return d.length >= 12 && d.length <= 13
  }, 'Informe DDD + número com 9 dígitos.'),
  email: z.string().email('E-mail inválido.').optional().or(z.literal('')),
  notes: z.string().optional(),
  marketingConsent: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

// ─── sub-components ──────────────────────────────────────────────────────────

function StepHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      {onBack && (
        <button
          onClick={onBack}
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 transition"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div>
        <h2 className="text-base font-semibold text-stone-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
      </div>
    </div>
  )
}

function OptionCard({
  title,
  subtitle,
  onClick,
  selected,
}: {
  title: string
  subtitle?: string
  onClick: () => void
  selected?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl border px-4 py-3.5 text-left transition hover:border-brand-400 hover:bg-brand-50/40',
        selected
          ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/30'
          : 'border-stone-200 bg-white',
      )}
    >
      <p className="text-sm font-semibold text-stone-900">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>}
    </button>
  )
}

// ─── date picker ─────────────────────────────────────────────────────────────

function DatePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (dateKey: string) => void
}) {
  const [offset, setOffset] = useState(0)
  const days = useMemo(() => {
    const base = today()
    return Array.from({ length: 7 }, (_, i) => addDays(base, offset * 7 + i))
  }, [offset])

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={offset === 0}
          className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 disabled:opacity-30 transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-stone-500 capitalize">
          {format(days[0], "MMMM 'de' yyyy", { locale: ptBR })}
        </span>
        <button
          onClick={() => setOffset((o) => (o < Math.floor(BOOKING_MAX_DAYS / 7) ? o + 1 : o))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 transition"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold uppercase text-stone-400 pb-1">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = toDateKey(day)
          const isSelected = key === value
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={cn(
                'flex aspect-square w-full items-center justify-center rounded-xl text-sm font-medium transition',
                isSelected
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'text-stone-700 hover:bg-brand-50 hover:text-brand-700',
              )}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export function PublicBookingPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [info, setInfo] = useState<PublicBusinessInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [step, setStep] = useState<Step>('service')
  const [booking, setBooking] = useState<Partial<BookingState>>({})

  const [slots, setSlots] = useState<PublicSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [formValues, setFormValues] = useState<FormValues>({
    name: '',
    phone: '',
    email: '',
    notes: '',
    marketingConsent: false,
  })
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormValues, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ id: string; cancelToken: string } | null>(null)

  // load business info
  useEffect(() => {
    if (!slug) return
    setLoadingInfo(true)
    api.publicBooking
      .getBusiness(slug)
      .then((data) => {
        if (!data) setNotFound(true)
        else setInfo(data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingInfo(false))
  }, [slug])

  // load slots when date changes
  useEffect(() => {
    if (!slug || !booking.serviceId || !booking.dateKey) return
    setLoadingSlots(true)
    api.publicBooking
      .getSlots({
        slug,
        serviceId: booking.serviceId,
        professionalId: booking.professionalId ?? null,
        date: booking.dateKey,
      })
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [slug, booking.serviceId, booking.professionalId, booking.dateKey])

  function selectService(id: string, name: string, durationMinutes: number, price: number) {
    setBooking({ serviceId: id, serviceName: name, durationMinutes, price })
    // skip professional step if only 1 or none
    const profs = info?.professionals ?? []
    if (profs.length <= 1) {
      const pro = profs[0] ?? null
      setBooking((b) => ({
        ...b,
        professionalId: pro?.id ?? null,
        professionalName: pro?.name ?? 'Qualquer profissional',
      }))
      setStep('date')
    } else {
      setStep('professional')
    }
  }

  function selectProfessional(id: string | null, name: string) {
    setBooking((b) => ({ ...b, professionalId: id, professionalName: name }))
    setStep('date')
  }

  function selectDate(dateKey: string) {
    setBooking((b) => ({ ...b, dateKey, slot: null }))
    setStep('time')
  }

  function selectSlot(slot: PublicSlot) {
    setBooking((b) => ({ ...b, slot }))
    setStep('form')
  }

  function validateForm(values: FormValues): boolean {
    const result = formSchema.safeParse(values)
    if (result.success) {
      setFormErrors({})
      return true
    }
    const errs: Partial<Record<keyof FormValues, string>> = {}
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof FormValues
      if (!errs[field]) errs[field] = issue.message
    }
    setFormErrors(errs)
    return false
  }

  async function handleSubmit() {
    if (!validateForm(formValues)) return
    if (!slug || !booking.serviceId || !booking.slot) return
    setSubmitting(true)
    try {
      const input: PublicBookingInput = {
        slug,
        serviceId: booking.serviceId,
        professionalId: booking.professionalId ?? null,
        startsAt: booking.slot.startsAt,
        name: formValues.name.trim(),
        phone: normalizePhoneBR(formValues.phone),
        email: formValues.email?.trim() || null,
        notes: formValues.notes?.trim() || null,
        marketingConsent: formValues.marketingConsent,
        honeypot: '',
      }
      const res = await api.publicBooking.create(input)
      setResult({ id: res.id, cancelToken: res.cancelToken })
      setStep('done')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível confirmar.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── render states ──────────────────────────────────────────────────────────

  if (loadingInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  if (notFound || !info) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stone-50 px-4 text-center">
        <Calendar className="h-10 w-10 text-stone-300" />
        <h1 className="text-lg font-semibold text-stone-800">Agenda não encontrada</h1>
        <p className="text-sm text-stone-500">O link pode ter mudado ou a agenda não está disponível.</p>
      </div>
    )
  }

  const { business, services, professionals } = info

  // ── done ───────────────────────────────────────────────────────────────────

  if (step === 'done' && result) {
    const calStart = booking.slot?.startsAt
      ? new Date(booking.slot.startsAt)
          .toISOString()
          .replace(/[-:]/g, '')
          .replace('.000', '')
      : ''
    const calEnd = booking.durationMinutes && booking.slot?.startsAt
      ? new Date(new Date(booking.slot.startsAt).getTime() + booking.durationMinutes * 60_000)
          .toISOString()
          .replace(/[-:]/g, '')
          .replace('.000', '')
      : ''
    const calTitle = encodeURIComponent(`${booking.serviceName} — ${business.name}`)
    const calDetails = encodeURIComponent(`Agendado em ${business.name}`)
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${calStart}/${calEnd}&details=${calDetails}`

    return (
      <Layout business={business}>
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">Agendado!</h2>
            <p className="mt-1 text-sm text-stone-500">Seu horário foi reservado com sucesso.</p>
          </div>
          <div className="w-full rounded-2xl border border-stone-200 bg-white p-4 text-left space-y-2.5">
            <InfoRow label="Serviço" value={booking.serviceName ?? ''} />
            <InfoRow label="Profissional" value={booking.professionalName ?? 'A definir'} />
            <InfoRow
              label="Data"
              value={booking.dateKey ? formatDateLabel(booking.dateKey) : ''}
            />
            <InfoRow label="Horário" value={booking.slot?.time ?? ''} />
            {(booking.price ?? 0) > 0 && (
              <InfoRow label="Valor" value={formatCurrency(booking.price ?? 0)} />
            )}
          </div>
          {business.whatsappNumber && (
            <p className="text-sm text-stone-500">
              Dúvidas? Fale pelo{' '}
              <a
                href={`https://wa.me/${business.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-700 hover:underline"
              >
                WhatsApp
              </a>
            </p>
          )}
          {calStart && calEnd && (
            <a
              href={gcalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 transition"
            >
              <Calendar className="h-4 w-4 text-brand-600" />
              Adicionar ao Google Agenda
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStep('service')
              setBooking({})
              setResult(null)
              setFormValues({ name: '', phone: '', email: '', notes: '', marketingConsent: false })
            }}
          >
            Fazer outro agendamento
          </Button>
        </div>
      </Layout>
    )
  }

  // ── steps ──────────────────────────────────────────────────────────────────

  return (
    <Layout business={business}>
      {/* service */}
      {step === 'service' && (
        <div>
          <StepHeader title="Escolha o serviço" />
          {services.length === 0 ? (
            <p className="text-sm text-stone-500">Nenhum serviço disponível no momento.</p>
          ) : (
            <div className="space-y-2">
              {services.map((service) => (
                <OptionCard
                  key={service.id}
                  title={service.name}
                  subtitle={`${formatDuration(service.durationMinutes)} · ${formatCurrency(service.price)}`}
                  onClick={() => selectService(service.id, service.name, service.durationMinutes, service.price)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* professional */}
      {step === 'professional' && (
        <div>
          <StepHeader
            title="Escolha o profissional"
            onBack={() => setStep('service')}
          />
          <div className="space-y-2">
            <OptionCard
              title="Qualquer profissional disponível"
              subtitle="Será atribuído automaticamente"
              onClick={() => selectProfessional(null, 'Qualquer profissional')}
            />
            {professionals.map((pro) => (
              <OptionCard
                key={pro.id}
                title={pro.name}
                onClick={() => selectProfessional(pro.id, pro.name)}
              />
            ))}
          </div>
        </div>
      )}

      {/* date */}
      {step === 'date' && (
        <div>
          <StepHeader
            title="Escolha a data"
            onBack={() =>
              setStep((info?.professionals.length ?? 0) > 1 ? 'professional' : 'service')
            }
          />
          <DatePicker
            value={booking.dateKey ?? ''}
            onChange={selectDate}
          />
        </div>
      )}

      {/* time */}
      {step === 'time' && (
        <div>
          <StepHeader
            title="Escolha o horário"
            subtitle={booking.dateKey ? formatDateLabel(booking.dateKey) : undefined}
            onBack={() => setStep('date')}
          />
          {loadingSlots ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center">
              <Clock className="mx-auto mb-2 h-6 w-6 text-stone-400" />
              <p className="text-sm font-medium text-stone-600">Nenhum horário disponível</p>
              <p className="mt-1 text-xs text-stone-400">Tente outra data</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => setStep('date')}
              >
                Escolher outra data
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  onClick={() => selectSlot(slot)}
                  className={cn(
                    'rounded-xl border py-2.5 text-sm font-semibold transition',
                    booking.slot?.startsAt === slot.startsAt
                      ? 'border-brand-500 bg-brand-700 text-white'
                      : 'border-stone-200 bg-white text-stone-800 hover:border-brand-400 hover:bg-brand-50',
                  )}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* form */}
      {step === 'form' && (
        <div>
          <StepHeader
            title="Seus dados"
            subtitle="Precisamos para confirmar o agendamento."
            onBack={() => setStep('time')}
          />
          {/* summary */}
          <div className="mb-5 rounded-2xl border border-stone-200 bg-stone-50 p-3.5 space-y-1.5">
            <InfoRow label="Serviço" value={booking.serviceName ?? ''} />
            <InfoRow label="Profissional" value={booking.professionalName ?? 'A definir'} />
            <InfoRow
              label="Data"
              value={booking.dateKey ? formatDateLabel(booking.dateKey) : ''}
            />
            <InfoRow label="Horário" value={booking.slot?.time ?? ''} />
            {(booking.price ?? 0) > 0 && (
              <InfoRow label="Valor" value={formatCurrency(booking.price ?? 0)} />
            )}
          </div>

          <div className="space-y-3">
            {/* honeypot — hidden */}
            <input
              type="text"
              name="website"
              className="sr-only"
              tabIndex={-1}
              autoComplete="off"
            />

            <Input
              label="Nome completo"
              placeholder="Seu nome"
              required
              value={formValues.name}
              onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))}
              error={formErrors.name}
              leftIcon={<User className="h-4 w-4" />}
            />
            <Input
              label="WhatsApp"
              placeholder="(11) 99999-9999"
              inputMode="tel"
              required
              value={formValues.phone}
              onChange={(e) => setFormValues((v) => ({ ...v, phone: e.target.value }))}
              error={formErrors.phone}
            />
            <Input
              label="E-mail (opcional)"
              type="email"
              placeholder="voce@email.com"
              value={formValues.email}
              onChange={(e) => setFormValues((v) => ({ ...v, email: e.target.value }))}
              error={formErrors.email}
            />
            <Input
              label="Observação (opcional)"
              placeholder="Algo que queira avisar…"
              value={formValues.notes}
              onChange={(e) => setFormValues((v) => ({ ...v, notes: e.target.value }))}
            />
            <label className="flex items-start gap-2.5 text-sm text-stone-600">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                checked={formValues.marketingConsent}
                onChange={(e) =>
                  setFormValues((v) => ({ ...v, marketingConsent: e.target.checked }))
                }
              />
              <span>
                Aceito receber lembretes e promoções pelo WhatsApp.{' '}
                <span className="text-stone-400">(opcional)</span>
              </span>
            </label>
          </div>

          <Button
            fullWidth
            size="lg"
            className="mt-5"
            loading={submitting}
            onClick={() => void handleSubmit()}
          >
            Confirmar agendamento
          </Button>
        </div>
      )}
    </Layout>
  )
}

// ─── layout wrapper ───────────────────────────────────────────────────────────

function Layout({
  business,
  children,
}: {
  business: PublicBusinessInfo['business']
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-stone-50">
      {/* header */}
      <div className="border-b border-stone-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-md items-center gap-3">
          {business.logoUrl ? (
            <img
              src={business.logoUrl}
              alt={business.name}
              className="h-10 w-10 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white">
              {business.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-stone-900">{business.name}</p>
            <p className="text-xs text-stone-400">Agendamento online</p>
          </div>
        </div>
      </div>
      {/* content */}
      <div className="mx-auto max-w-md px-4 py-6">{children}</div>
    </div>
  )
}

// ─── info row ────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-stone-500 shrink-0">{label}</span>
      <span className="text-xs font-semibold text-stone-800 text-right capitalize">{value}</span>
    </div>
  )
}
