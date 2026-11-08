import {
  CalendarCheck,
  CalendarDays,
  Cake,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Settings,
  Sparkles,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { cn, formatDateBR } from '../../lib/format'
import { Avatar } from '../ui'
import { useState } from 'react'

const mainNav = [
  { to: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/aniversariantes', label: 'Aniversariantes', icon: Cake },
]

const secondaryNav = [
  { to: '/mensagens', label: 'Modelos de mensagem', icon: MessageSquareText },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/assinatura', label: 'Assinatura', icon: Wallet },
  { to: '/perfil', label: 'Perfil', icon: User },
]

const moreRoutes = ['/mais', '/mensagens', '/configuracoes', '/assinatura', '/perfil']

export function AppShell() {
  const { business, session, signOut, isDemo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const trialEnds = business ? new Date(business.trialEndsAt) : null
  const trialDays = trialEnds
    ? Math.max(
        0,
        Math.ceil((trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      )
    : 0
  const showTrial =
    business?.subscriptionStatus === 'trial' && !business.accessRequestedAt

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
      isActive
        ? 'bg-brand-50 text-brand-800'
        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
    )

  return (
    <div className="min-h-screen bg-stone-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-stone-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-stone-100 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white">
            <CalendarCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-900">
              AgendaCliente
            </p>
            <p className="truncate text-xs text-stone-500">{business?.name}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {mainNav.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}

          <div className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            Gestão
          </div>
          {secondaryNav.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {showTrial && (
          <div className="mx-3 mb-3 rounded-xl bg-brand-50 p-3 text-xs text-brand-800 ring-1 ring-brand-100">
            <p className="flex items-center gap-1.5 font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              Período de implantação
            </p>
            <p className="mt-1 text-brand-700">
              {trialDays} dia(s) restante(s) · até {formatDateBR(business?.trialEndsAt)}
            </p>
            <Link
              to="/assinatura"
              className="mt-2 inline-flex items-center gap-0.5 font-semibold text-brand-800 hover:underline"
            >
              Ver assinatura <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        <div className="border-t border-stone-100 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar name={session?.fullName ?? 'Usuário'} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-800">
                {session?.fullName}
              </p>
              <p className="truncate text-xs text-stone-500">{session?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-stone-500 transition hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
          {isDemo && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-center text-[11px] font-medium text-amber-700">
              Modo demonstração local
            </p>
          )}
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-stone-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white">
              <CalendarCheck className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-stone-900">AgendaCliente</span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-stone-900/30" />
            <div
              className="absolute right-3 top-3 w-64 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Avatar name={session?.fullName ?? 'Usuário'} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-800">
                    {session?.fullName}
                  </p>
                  <p className="truncate text-xs text-stone-500">{session?.email}</p>
                </div>
              </div>
              <div className="my-1 h-px bg-stone-100" />
              {secondaryNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={navLinkClass}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-5 w-5" />
                Sair
              </button>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:pb-10 lg:pt-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur safe-bottom lg:hidden">
        <div className="grid grid-cols-5">
          {mainNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition',
                  isActive ? 'text-brand-700' : 'text-stone-500',
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
          <Link
            to="/mais"
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition',
              moreRoutes.some((route) => location.pathname.startsWith(route))
                ? 'text-brand-700'
                : 'text-stone-500',
            )}
          >
            <Menu className="h-5 w-5" />
            Mais
          </Link>
        </div>
      </nav>
    </div>
  )
}
