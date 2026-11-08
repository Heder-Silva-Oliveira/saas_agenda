import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Business, SessionUser, SignUpInput, SignUpResult } from '../types'
import { api } from '../services'
import { queryClient } from '../lib/queryClient'

interface AuthContextValue {
  session: SessionUser | null
  business: Business | null
  loading: boolean
  error: string | null
  isDemo: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: SignUpInput) => Promise<SignUpResult>
  signOut: () => Promise<void>
  refreshBusiness: () => Promise<Business>
  applyBusiness: (business: Business) => void
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Algo deu errado. Tente novamente.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionUser | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshBusiness = useCallback(async () => {
    const data = await api.business.get()
    setBusiness(data)
    return data
  }, [])

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      try {
        const currentSession = await api.auth.getSession()
        if (!active) return
        if (currentSession) {
          setSession(currentSession)
          const data = await api.business.get()
          if (active) setBusiness(data)
        }
      } catch (err) {
        if (active) setError(errorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
    }

    void bootstrap()
    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    const user = await api.auth.signIn(email, password)
    setSession(user)
    const data = await api.business.get()
    setBusiness(data)
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    setError(null)
    const result = await api.auth.signUp(input)
    if (result.session) {
      setSession(result.session)
      const data = await api.business.get()
      setBusiness(data)
    }
    return result
  }, [])

  const signOut = useCallback(async () => {
    await api.auth.signOut()
    setSession(null)
    setBusiness(null)
    queryClient.clear()
  }, [])

  const applyBusiness = useCallback((data: Business) => {
    setBusiness(data)
    queryClient.setQueryData(['business'], data)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      business,
      loading,
      error,
      isDemo: api.mode === 'demo',
      signIn,
      signUp,
      signOut,
      refreshBusiness,
      applyBusiness,
      clearError: () => setError(null),
    }),
    [
      session,
      business,
      loading,
      error,
      signIn,
      signUp,
      signOut,
      refreshBusiness,
      applyBusiness,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return context
}
