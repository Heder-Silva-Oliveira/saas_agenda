import {
  ChevronRight,
  LogOut,
  MessageSquareText,
  Settings,
  Sparkles,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, Card } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { formatDateBR } from '../../lib/format'
import { SEGMENT_LABELS } from '../../domain/constants'

const links = [
  {
    to: '/mensagens',
    label: 'Modelos de mensagem',
    description: 'Textos de confirmação, lembrete, aniversário e retorno',
    icon: MessageSquareText,
  },
  {
    to: '/configuracoes',
    label: 'Configurações do negócio',
    description: 'Dados, horário de funcionamento e serviços',
    icon: Settings,
  },
  {
    to: '/assinatura',
    label: 'Assinatura',
    description: 'Plano, período de implantação e solicitação de acesso',
    icon: Wallet,
  },
  {
    to: '/perfil',
    label: 'Perfil do usuário',
    description: 'Seus dados de acesso e segurança',
    icon: User,
  },
  {
    to: '/clientes?inativos=30',
    label: 'Clientes inativos',
    description: 'Recupere clientes sem atendimento recente',
    icon: Users,
  },
]

export function MorePage() {
  const { business, session, signOut, isDemo } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
          Mais
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Configurações, conta e atalhos do seu negócio.
        </p>
      </div>

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Avatar name={business?.name ?? 'Negócio'} src={business?.logoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-stone-900">
              {business?.name}
            </p>
            <Badge variant="brand">
              {business ? SEGMENT_LABELS[business.segment] : 'Negócio'}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-stone-500">{session?.fullName}</p>
          <p className="text-xs text-stone-400">
            Implantação até {formatDateBR(business?.trialEndsAt)}
          </p>
        </div>
      </Card>

      {business?.subscriptionStatus === 'trial' && (
        <Link to="/assinatura" className="block">
          <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
            <Sparkles className="h-5 w-5 text-brand-700" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-brand-900">
                Período de implantação
              </p>
              <p className="text-xs text-brand-700">
                Garanta sua assinatura de R$ 50/mês para continuar depois de{' '}
                {formatDateBR(business.trialEndsAt)}.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-brand-700" />
          </div>
        </Link>
      )}

      <Card className="divide-y divide-stone-100">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-stone-50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
              <link.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-stone-900">{link.label}</p>
              <p className="text-xs text-stone-500">{link.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
          </Link>
        ))}
      </Card>

      {isDemo && (
        <Card className="border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          <p className="font-semibold">Modo demonstração local</p>
          <p className="mt-1">
            Os dados desta sessão ficam no seu navegador. Para usar em produção, configure
            o Supabase no arquivo .env e rode as migrações SQL.
          </p>
        </Card>
      )}

      <Button
        variant="secondary"
        fullWidth
        className="text-rose-600"
        onClick={async () => {
          await signOut()
          navigate('/login', { replace: true })
        }}
        leftIcon={<LogOut className="h-4 w-4" />}
      >
        Sair da conta
      </Button>
    </div>
  )
}
