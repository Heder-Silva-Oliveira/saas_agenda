import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import {
  NotFoundPage,
  ProtectedRoute,
  RedirectIfAuthenticated,
} from './components/layout/ProtectedRoute'
import { AgendaPage } from './pages/agenda/AgendaPage'
import { AppointmentFormPage } from './pages/agenda/AppointmentFormPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { LoginPage } from './pages/auth/LoginPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { SignupPage } from './pages/auth/SignupPage'
import { BirthdaysPage } from './pages/birthdays/BirthdaysPage'
import { ClientDetailPage } from './pages/clients/ClientDetailPage'
import { ClientFormPage } from './pages/clients/ClientFormPage'
import { ClientsPage } from './pages/clients/ClientsPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { TemplatesPage } from './pages/messages/TemplatesPage'
import { MorePage } from './pages/more/MorePage'
import { OnboardingPage } from './pages/onboarding/OnboardingPage'
import { ProfilePage } from './pages/profile/ProfilePage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { SubscriptionPage } from './pages/subscription/SubscriptionPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/cadastro"
        element={
          <RedirectIfAuthenticated>
            <SignupPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/recuperar-senha"
        element={
          <RedirectIfAuthenticated>
            <ForgotPasswordPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<OnboardingPage />} />

        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/clientes/novo" element={<ClientFormPage />} />
          <Route path="/clientes/:id" element={<ClientDetailPage />} />
          <Route path="/clientes/:id/editar" element={<ClientFormPage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/agenda/novo" element={<AppointmentFormPage />} />
          <Route path="/agenda/:id/editar" element={<AppointmentFormPage />} />
          <Route path="/aniversariantes" element={<BirthdaysPage />} />
          <Route path="/mensagens" element={<TemplatesPage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
          <Route path="/assinatura" element={<SubscriptionPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/mais" element={<MorePage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
