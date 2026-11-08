import { CalendarCheck, MessageCircle, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { APP_NAME, PLAN } from '../../config'
import { formatCurrency } from '../../lib/format'

export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="min-h-screen bg-stone-100 lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-900 lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <CalendarCheck className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold">{APP_NAME}</span>
          </Link>

          <div className="mt-16 max-w-md">
            <h2 className="text-3xl font-semibold leading-tight text-white">
              Menos faltas, mais clientes de volta no seu negócio.
            </h2>
            <p className="mt-4 text-brand-100">
              Organize clientes, horários e aniversários em um só lugar. Envie mensagens
              pelo WhatsApp com um clique, sem automações arriscadas.
            </p>

            <ul className="mt-8 space-y-4 text-sm text-brand-50">
              <li className="flex items-start gap-3">
                <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
                Agenda mensal, semanal e diária com controle de conflitos.
              </li>
              <li className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
                Mensagens prontas para confirmação, lembrete e retorno.
              </li>
              <li className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
                Aniversariantes e clientes inativos sempre à vista.
              </li>
            </ul>
          </div>
        </div>

        <div className="relative z-10 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-brand-50">
          <p className="font-medium text-white">{PLAN.name}</p>
          <p className="mt-1 text-brand-100">
            {formatCurrency(PLAN.price)}/{PLAN.interval} por negócio · 7 dias para
            implantação
          </p>
        </div>
      </div>

      <div className="flex min-h-screen flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-stone-900 lg:hidden"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white">
              <CalendarCheck className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold">{APP_NAME}</span>
          </Link>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
              {title}
            </h1>
            {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-card sm:p-6">
            {children}
          </div>

          <p className="mt-6 text-center text-xs text-stone-500">
            {APP_NAME} · Gestão simples para negócios de serviço
          </p>
        </div>
      </div>
    </div>
  )
}
