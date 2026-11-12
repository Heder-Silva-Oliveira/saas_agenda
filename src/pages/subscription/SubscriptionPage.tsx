import { zodResolver } from '@hookform/resolvers/zod'
import {
  BadgeCheck,
  Check,
  Clock,
  CreditCard,
  MessageCircle,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  Modal,
  Textarea,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { PLAN, SUPPORT_WHATSAPP } from '../../config'
import { isTrialActive } from '../../domain/rules'
import { formatCurrency, formatDateBR, normalizePhoneBR, onlyDigits } from '../../lib/format'
import { api } from '../../services'

const schema = z.object({
  name: z.string().min(3, 'Informe seu nome.'),
  email: z.string().min(1, 'Informe seu e-mail.').email('E-mail inválido.'),
  phone: z
    .string()
    .min(1, 'Informe seu telefone.')
    .refine((value) => {
      const digits = onlyDigits(value)
      return digits.length >= 10 && digits.length <= 13
    }, 'Informe DDD + número.'),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function SubscriptionPage() {
  const { business, session, refreshBusiness } = useAuth()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: session?.fullName ?? '',
      email: session?.email ?? '',
      phone: business?.whatsappNumber ?? '',
      note: '',
    },
  })

  if (!business) return null

  const trialActive = isTrialActive(business)
  const requested = Boolean(business.accessRequestedAt)
  const active = business.subscriptionStatus === 'active'

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await api.business.requestAccess({
        name: values.name,
        email: values.email,
        phone: normalizePhoneBR(values.phone),
        note: values.note,
      })
      await refreshBusiness()
      toast.success('Solicitação registrada. Entraremos em contato.')
      setOpen(false)
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar a solicitação.',
      )
    }
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
          Assinatura
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Um único plano para manter seu negócio organizado.
        </p>
      </div>

      {!trialActive && !active && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Período de implantação encerrado</p>
            <p className="text-xs">
              Para continuar usando o Controlativa, solicite a ativação do plano. Seus
              dados continuam salvos.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="bg-brand-900 px-5 py-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-brand-200">Plano único</p>
                <h2 className="text-2xl font-semibold">{PLAN.name}</h2>
              </div>
              <div className="text-right">
                <p className="text-3xl font-semibold">{formatCurrency(PLAN.price)}</p>
                <p className="text-sm text-brand-200">por {PLAN.interval} · por negócio</p>
              </div>
            </div>
            <p className="mt-3 max-w-xl text-sm text-brand-100">{PLAN.description}</p>
          </div>

          <div className="p-5">
            <ul className="grid gap-2 sm:grid-cols-2">
              {PLAN.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-stone-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
              <p className="flex items-center gap-1.5 font-medium text-stone-700">
                <CreditCard className="h-4 w-4" />
                Como funciona a cobrança nesta versão
              </p>
              <p className="mt-1">
                A ativação é feita por contato: você solicita o acesso e combinamos a
                forma de pagamento. A integração com cartão recorrente (Stripe ou Mercado
                Pago) está prevista para a próxima etapa.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {active ? (
                <Badge variant="success">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Assinatura ativa
                </Badge>
              ) : requested ? (
                <Badge variant="warning">
                  Solicitação enviada em {formatDateBR(business.accessRequestedAt)}
                </Badge>
              ) : (
                <Button onClick={() => setOpen(true)} leftIcon={<Send className="h-4 w-4" />}>
                  Solicitar acesso
                </Button>
              )}
              <a
                href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
                  'Olá! Quero saber mais sobre a assinatura do Controlativa.',
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button
                  variant="secondary"
                  leftIcon={<MessageCircle className="h-4 w-4" />}
                >
                  Falar com o suporte
                </Button>
              </a>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Situação atual" />
            <dl className="divide-y divide-stone-100 text-sm">
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <dt className="text-stone-500">Status</dt>
                <dd>
                  <Badge
                    variant={
                      active ? 'success' : trialActive ? 'info' : requested ? 'warning' : 'danger'
                    }
                  >
                    {active
                      ? 'Ativo'
                      : trialActive
                        ? 'Em implantação'
                        : requested
                          ? 'Aguardando ativação'
                          : 'Expirado'}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <dt className="text-stone-500">Plano</dt>
                <dd className="font-medium text-stone-800">{business.plan}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <dt className="text-stone-500">Valor</dt>
                <dd className="font-medium text-stone-800">
                  {formatCurrency(PLAN.price)}/{PLAN.interval}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <dt className="text-stone-500">Implantação até</dt>
                <dd className="font-medium text-stone-800">
                  {formatDateBR(business.trialEndsAt)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <dt className="text-stone-500">Negócio</dt>
                <dd className="max-w-[55%] truncate text-right font-medium text-stone-800">
                  {business.name}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
              <ShieldCheck className="h-4 w-4 text-brand-600" />
              Seus dados ficam salvos
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Mesmo se o período de implantação terminar, clientes, agenda e histórico
              permanecem armazenados com segurança. A reativação libera o acesso
              novamente.
            </p>
          </Card>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Solicitar acesso"
        description="Registre seus dados para ativarmos o plano de R$ 50/mês."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={() => void onSubmit()}
              loading={isSubmitting}
              leftIcon={<Send className="h-4 w-4" />}
            >
              Enviar solicitação
            </Button>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            label="Seu nome"
            required
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="E-mail"
            type="email"
            required
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Telefone / WhatsApp"
            inputMode="tel"
            required
            error={errors.phone?.message}
            {...register('phone')}
          />
          <Textarea
            label="Observação (opcional)"
            placeholder="Conte como pretende usar o Controlativa ou tire dúvidas."
            {...register('note')}
          />
          {serverError && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
              {serverError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}


