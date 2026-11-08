import { useQuery } from '@tanstack/react-query'
import { api } from '../services'
import { queryKeys } from '../lib/queryClient'

export function useClients() {
  return useQuery({
    queryKey: queryKeys.clients,
    queryFn: () => api.clients.list(),
  })
}

export function useServices() {
  return useQuery({
    queryKey: queryKeys.services,
    queryFn: () => api.services.list(),
  })
}

export function useAppointments() {
  return useQuery({
    queryKey: queryKeys.appointments,
    queryFn: () => api.appointments.list(),
  })
}

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates,
    queryFn: () => api.templates.list(),
  })
}

export function useLogs() {
  return useQuery({
    queryKey: queryKeys.logs,
    queryFn: () => api.logs.list(),
  })
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => api.dashboard.get(),
  })
}
