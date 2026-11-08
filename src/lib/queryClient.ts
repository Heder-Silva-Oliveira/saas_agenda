import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export const queryKeys = {
  business: ['business'] as const,
  clients: ['clients'] as const,
  services: ['services'] as const,
  appointments: ['appointments'] as const,
  templates: ['templates'] as const,
  logs: ['logs'] as const,
  dashboard: ['dashboard'] as const,
}
