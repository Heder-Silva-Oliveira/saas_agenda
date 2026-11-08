import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Info } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Button, Input } from '../../components/ui'
import { DEMO_CREDENTIALS } from '../../config'
import { useAuth } from '../../context/AuthContext'

const schema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').email('E-mail inválido.'),
  password: z.string().min(1, 'Informe sua senha.'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { signIn, isDemo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)
  const [demoLoading, setDemoLoading] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await signIn(values.email, values.password)
      toast.success('Bem-vindo de volta!')
      navigate(from, { replace: true })
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Não foi possível entrar.',
      )
    }
  })

  const loginDemo = async () => {
    setServerError(null)
    setDemoLoading(true)
    try {
      await signIn(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password)
      toast.success('Conta de demonstração carregada.')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Não foi possível entrar.',
      )
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <AuthLayout title="Entrar na sua conta" subtitle="Acesse o painel do seu negócio.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
          placeholder="Sua senha"
          required
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex justify-end">
          <Link
            to="/recuperar-senha"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Esqueceu a senha?
          </Link>
        </div>

        {serverError && (
          <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
            {serverError}
          </div>
        )}

        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          Entrar
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      {isDemo && (
        <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          <p className="flex items-center gap-1.5 font-semibold">
            <Info className="h-4 w-4" />
            Modo demonstração
          </p>
          <p className="mt-1 text-xs">
            Use a conta pronta com dados de exemplo ou crie um negócio novo.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            loading={demoLoading}
            onClick={loginDemo}
          >
            Entrar com conta demo
          </Button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-stone-500">
        Ainda não tem conta?{' '}
        <Link to="/cadastro" className="font-semibold text-brand-700 hover:underline">
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  )
}
