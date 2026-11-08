import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { TRIAL_ENFORCEMENT } from '../../config'
import { isTrialActive } from '../../domain/rules'
import { Button } from '../ui'
import { LoadingState, ErrorState } from '../ui'

export function ProtectedRoute() {
  const { session, business, loading, error, refreshBusiness } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <LoadingState label="Preparando seu painel…" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (error && !business) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
        <ErrorState
          message={error}
          onRetry={() => {
            void refreshBusiness().catch(() => window.location.reload())
          }}
        />
      </div>
    )
  }

  if (!business) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <LoadingState label="Carregando negócio…" />
      </div>
    )
  }

  const isOnboarding = location.pathname === '/onboarding'

  if (!business.onboardingCompleted && !isOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  const trialExpired =
    TRIAL_ENFORCEMENT &&
    business.onboardingCompleted &&
    !isTrialActive(business) &&
    business.subscriptionStatus !== 'active'

  const allowedWhenExpired = ['/assinatura', '/perfil']

  if (trialExpired && !allowedWhenExpired.includes(location.pathname)) {
    return <Navigate to="/assinatura" replace />
  }

  return <Outlet />
}

export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { session, business, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <LoadingState label="Carregando…" />
      </div>
    )
  }

  if (session && business) {
    if (!business.onboardingCompleted) {
      return <Navigate to="/onboarding" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-semibold text-stone-300">404</p>
      <h1 className="text-lg font-semibold text-stone-900">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-stone-500">
        O endereço que você tentou acessar não existe ou foi movido.
      </p>
      <Button onClick={() => (window.location.href = '/dashboard')}>
        Voltar ao painel
      </Button>
    </div>
  )
}
