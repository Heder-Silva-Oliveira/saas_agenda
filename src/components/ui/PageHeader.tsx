import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/format'

export function PageHeader({
  title,
  description,
  actions,
  backTo,
  backLabel = 'Voltar',
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  backTo?: string
  backLabel?: string
  className?: string
}) {
  return (
    <div className={cn('mb-5', className)}>
      {backTo && (
        <Link
          to={backTo}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-stone-500 transition hover:text-stone-800"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
            {title}
          </h1>
          {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
