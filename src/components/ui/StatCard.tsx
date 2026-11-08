import type { ReactNode } from 'react'
import { cn } from '../../lib/format'
import { Card } from './Card'

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
  tone?: 'brand' | 'emerald' | 'amber' | 'rose' | 'stone'
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    stone: 'bg-stone-100 text-stone-600',
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>}
        </div>
        {icon && (
          <div className={cn('rounded-xl p-2', tones[tone])} aria-hidden>
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
