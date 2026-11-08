import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Button, Input } from '../../components/ui'
import { api } from '../../services'

const schema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').email('E-mail inválido.'),
})

type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await api.auth.resetPassword(values.email)
      setSent(true)
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Não foi possível enviar o e-mail.',
      )
    }
  })

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Enviaremos um link para redefinir sua senha."
    >
      {sent ? (
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <MailCheck className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-stone-900">Link enviado</h2>
          <p className="mt-1 text-sm text-stone-600">
            Se o e-mail estiver cadastrado, você receberá um link para redefinir a
            senha. Verifique também a caixa de spam.
          </p>
          <Link to="/login" className="mt-5 w-full">
            <Button fullWidth leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar ao login
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="E-mail"
            type="email"
            placeholder="voce@email.com"
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register('email')}
          />

          {serverError && (
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
              {serverError}
            </div>
          )}

          <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
            Enviar link de recuperação
          </Button>

          <Link
            to="/login"
            className="flex items-center justify-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}
