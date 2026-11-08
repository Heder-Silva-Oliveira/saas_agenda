import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, LogOut, Mail, Settings, ShieldCheck, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { SEGMENT_LABELS } from '../../domain/constants'
import { api } from '../../services'

const schema = z
  .object({
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
    confirmPassword: z.string().min(6, 'Confirme a nova senha.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })

type FormValues = z.infer<typeof schema>

export function ProfilePage() {
  const { session, business, signOut, isDemo } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await api.auth.updatePassword(values.password)
      reset()
      toast.success('Senha atualizada.')
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Não foi possível atualizar a senha.',
      )
    }
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
          Perfil do usuário
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Seus dados de acesso e informações da conta.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
              <Avatar name={session?.fullName ?? 'Usuário'} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-stone-900">
                    {session?.fullName}
                  </h2>
                  <Badge variant="brand">Proprietário</Badge>
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-500">
                  <Mail className="h-4 w-4" />
                  {session?.email}
                </p>
              </div>
            </div>
            <div className="border-t border-stone-100 px-4 py-3 text-sm sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                    Negócio
                  </p>
                  <p className="font-medium text-stone-800">{business?.name}</p>
                  <p className="text-xs text-stone-500">
                    {business ? SEGMENT_LABELS[business.segment] : ''}
                  </p>
                </div>
                <Link to="/configuracoes">
                  <Button variant="secondary" size="sm" leftIcon={<Settings className="h-4 w-4" />}>
                    Editar negócio
                  </Button>
                </Link>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Alterar senha"
              description="Escolha uma nova senha com pelo menos 6 caracteres."
              action={<KeyRound className="h-5 w-5 text-stone-400" />}
            />
            <form onSubmit={onSubmit} className="space-y-3 p-4 sm:p-5">
              <Input
                label="Nova senha"
                type="password"
                autoComplete="new-password"
                required
                error={errors.password?.message}
                {...register('password')}
              />
              <Input
                label="Confirmar nova senha"
                type="password"
                autoComplete="new-password"
                required
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />
              {serverError && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
                  {serverError}
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" loading={isSubmitting}>
                  Atualizar senha
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Conta" />
            <dl className="divide-y divide-stone-100 text-sm">
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <dt className="text-stone-500">Plano</dt>
                <dd className="font-medium text-stone-800">{business?.plan}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <dt className="text-stone-500">Ambiente</dt>
                <dd>
                  <Badge variant={isDemo ? 'warning' : 'success'}>
                    {isDemo ? 'Demonstração' : 'Produção'}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <dt className="text-stone-500">Isolamento</dt>
                <dd className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Por negócio
                </dd>
              </div>
            </dl>
            <div className="space-y-2 border-t border-stone-100 p-4">
              <Link to="/assinatura" className="block">
                <Button
                  variant="secondary"
                  fullWidth
                  leftIcon={<Wallet className="h-4 w-4" />}
                >
                  Ver assinatura
                </Button>
              </Link>
              <Button
                variant="ghost"
                fullWidth
                className="text-rose-600 hover:bg-rose-50"
                onClick={async () => {
                  await signOut()
                  navigate('/login', { replace: true })
                }}
                leftIcon={<LogOut className="h-4 w-4" />}
              >
                Sair da conta
              </Button>
            </div>
          </Card>

          <Card className="p-4 text-xs text-stone-500">
            <p className="font-semibold text-stone-700">Privacidade e consentimento</p>
            <p className="mt-1">
              Cada negócio acessa apenas os próprios dados. Mensagens de marketing exigem
              consentimento registrado do cliente e podem ser revogadas a qualquer
              momento.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
