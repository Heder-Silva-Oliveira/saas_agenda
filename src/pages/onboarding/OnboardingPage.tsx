import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, CalendarCheck, Check, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { LogoUploader } from '../../components/LogoUploader'
import { OpeningHoursEditor } from '../../components/OpeningHoursEditor'
import { Button, Card, Input, Select } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { SEGMENTS, DEFAULT_OPENING_HOURS } from '../../domain/constants'
import { normalizePhoneBR, onlyDigits } from '../../lib/format'
import { api } from '../../services'
import type { OpeningHours } from '../../types'

const schema = z.object({
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
  whatsappNumber: z
    .string()
    .min(1, 'Informe o WhatsApp do negócio.')
    .refine(
      (value) => {
        const digits = onlyDigits(value)
        return digits.length >= 10 && digits.length <= 13
      },
      { message: 'Informe DDD + número, por exemplo (11) 98765-4321.' },
    ),
})

type FormValues = z.infer<typeof schema>

export function OnboardingPage() {
  const { business, applyBusiness, signOut, session } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [logoUrl, setLogoUrl] = useState<string | null>(business?.logoUrl ?? null)
  const [openingHours, setOpeningHours] = useState<OpeningHours>(
    business?.openingHours ?? DEFAULT_OPENING_HOURS,
  )
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: business?.name ?? '',
      segment: business?.segment ?? 'barbearia',
      whatsappNumber: business?.whatsappNumber ?? '',
    },
  })

  if (!business) return null
  if (business.onboardingCompleted) return <Navigate to="/dashboard" replace />

  const goNext = async () => {
    const valid = await trigger()
    if (valid) setStep(2)
  }

  const finish = async () => {
    setServerError(null)
    setSubmitting(true)
    try {
      const values = getValues()
      const updated = await api.business.update({
        name: values.name,
        segment: values.segment,
        whatsappNumber: normalizePhoneBR(values.whatsappNumber),
        openingHours,
        logoUrl,
        onboardingCompleted: true,
      })
      applyBusiness(updated)
      toast.success('Negócio configurado! Bem-vindo ao Controlativa.')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Não foi possível salvar.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white">
              <CalendarCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-stone-900">Controlativa</p>
              <p className="text-xs text-stone-500">{session?.fullName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await signOut()
              navigate('/login', { replace: true })
            }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-stone-500">
            <span>Passo {step} de 2</span>
            <span>{step === 1 ? 'Dados do negócio' : 'Horário de funcionamento'}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>

        <Card className="p-5 sm:p-6">
          {step === 1 ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void goNext()
              }}
              className="space-y-5"
            >
              <div>
                <h1 className="text-xl font-semibold text-stone-900">
                  Vamos configurar seu negócio
                </h1>
                <p className="mt-1 text-sm text-stone-500">
                  Esses dados aparecem nas mensagens enviadas aos seus clientes.
                </p>
              </div>

              <Input
                label="Nome do negócio"
                placeholder="Studio Maria Beauty"
                required
                error={errors.name?.message}
                {...register('name')}
              />

              <Select
                label="Segmento"
                required
                error={errors.segment?.message}
                {...register('segment')}
              >
                {SEGMENTS.map((segment) => (
                  <option key={segment.value} value={segment.value}>
                    {segment.label}
                  </option>
                ))}
              </Select>

              <Input
                label="WhatsApp do negócio"
                placeholder="(11) 98765-4321"
                inputMode="tel"
                required
                hint="Usado no contato com clientes e nos modelos de mensagem."
                error={errors.whatsappNumber?.message}
                {...register('whatsappNumber')}
              />

              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-700">Logo (opcional)</p>
                <LogoUploader
                  value={logoUrl}
                  name={getValues('name')}
                  onChange={setLogoUrl}
                />
              </div>

              <Button type="submit" fullWidth size="lg">
                Continuar
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-semibold text-stone-900">
                  Horário de funcionamento
                </h1>
                <p className="mt-1 text-sm text-stone-500">
                  Usamos esses horários para mostrar os slots livres na agenda. Você pode
                  ajustar depois.
                </p>
              </div>

              <OpeningHoursEditor value={openingHours} onChange={setOpeningHours} />

              {serverError && (
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
                  {serverError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button
                  variant="secondary"
                  onClick={() => setStep(1)}
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                >
                  Voltar
                </Button>
                <Button
                  size="lg"
                  loading={submitting}
                  onClick={() => void finish()}
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  Concluir configuração
                </Button>
              </div>
            </div>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-stone-500">
          Você pode alterar todas essas informações depois em Configurações.
        </p>
      </div>
    </div>
  )
}
