import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Button, Input } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

const schema = z
  .object({
    fullName: z.string().min(3, 'Informe seu nome completo.'),
    businessName: z.string().min(2, 'Informe o nome do negócio.'),
    email: z.string().min(1, 'Informe seu e-mail.').email('E-mail inválido.'),
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
    confirmPassword: z.string().min(6, 'Confirme sua senha.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })

type FormValues = z.infer<typeof schema>

export function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      businessName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const result = await signUp({
        fullName: values.fullName,
        businessName: values.businessName,
        email: values.email,
        password: values.password,
      })
      if (result.needsEmailConfirmation) {
        setNeedsConfirmation(true)
        return
      }
      toast.success('Conta criada! Vamos configurar seu negócio.')
      navigate('/onboarding', { replace: true })
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Não foi possível criar a conta.',
      )
    }
  })

  if (needsConfirmation) {
    return (
      <AuthLayout
        title="Confirme seu e-mail"
        subtitle="Falta pouco para começar."
      >
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <MailCheck className="h-6 w-6" />
          </div>
          <p className="text-sm text-stone-600">
            Enviamos um link de confirmação para o seu e-mail. Depois de confirmar,
            volte e faça login para configurar seu negócio.
          </p>
          <Button className="mt-5" fullWidth onClick={() => navigate('/login')}>
            Ir para o login
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Criar sua conta"
      subtitle="Comece com 7 dias para implantação e demonstração."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Seu nome"
          placeholder="Maria Silva"
          autoComplete="name"
          required
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <Input
          label="Nome do negócio"
          placeholder="Studio Maria Beauty"
          required
          error={errors.businessName?.message}
          {...register('businessName')}
        />
        <Input
          label="E-mail"
          type="email"
          placeholder="voce@email.com"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Senha"
            type="password"
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
            required
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Confirmar senha"
            type="password"
            placeholder="Repita a senha"
            autoComplete="new-password"
            required
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>

        {serverError && (
          <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
            {serverError}
          </div>
        )}

        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          Criar conta
          <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="text-center text-xs text-stone-500">
          Ao criar a conta você concorda com o uso responsável das mensagens pelo
          WhatsApp. Nenhuma mensagem automática é enviada sem consentimento.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-stone-500">
        Já tem conta?{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  )
}
