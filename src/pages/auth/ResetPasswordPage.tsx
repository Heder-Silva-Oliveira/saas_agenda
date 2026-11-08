import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Button, Input } from '../../components/ui'
import { api } from '../../services'
import { useState } from 'react'

const schema = z
  .object({
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
    confirmPassword: z.string().min(6, 'Confirme sua senha.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })

type FormValues = z.infer<typeof schema>

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await api.auth.updatePassword(values.password)
      toast.success('Senha atualizada. Faça login novamente.')
      navigate('/login', { replace: true })
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Não foi possível atualizar a senha.',
      )
    }
  })

  return (
    <AuthLayout
      title="Criar nova senha"
      subtitle="Escolha uma senha segura para sua conta."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Nova senha"
          type="password"
          placeholder="Mínimo 6 caracteres"
          autoComplete="new-password"
          required
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          placeholder="Repita a senha"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {serverError && (
          <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
            {serverError}
          </div>
        )}

        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          Atualizar senha
        </Button>
      </form>
    </AuthLayout>
  )
}
