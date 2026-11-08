import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../../lib/format'

const baseField =
  'w-full rounded-xl border border-stone-300 bg-white px-3.5 text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-stone-50 disabled:text-stone-500'

interface FieldShellProps {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  htmlFor?: string
  children: ReactNode
  className?: string
}

function FieldShell({
  label,
  error,
  hint,
  required,
  htmlFor,
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-stone-700">
          {label}
          {required && <span className="ml-0.5 text-rose-600">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  containerClassName?: string
  leftIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, containerClassName, className, id, required, leftIcon, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      required={required}
      htmlFor={inputId}
      className={containerClassName}
    >
      <div className="relative">
        {leftIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            baseField,
            'h-11 text-sm',
            leftIcon ? 'pl-10' : undefined,
            error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
      </div>
    </FieldShell>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  containerClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { label, error, hint, containerClassName, className, id, required, ...props },
    ref,
  ) {
    const generatedId = useId()
    const inputId = id ?? generatedId

    return (
      <FieldShell
        label={label}
        error={error}
        hint={hint}
        required={required}
        htmlFor={inputId}
        className={containerClassName}
      >
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            baseField,
            'min-h-[96px] py-2.5 text-sm',
            error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
      </FieldShell>
    )
  },
)

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  containerClassName?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, containerClassName, className, id, required, children, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      required={required}
      htmlFor={inputId}
      className={containerClassName}
    >
      <select
        ref={ref}
        id={inputId}
        className={cn(
          baseField,
          'h-11 text-sm',
          error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20',
          className,
        )}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  )
})

export { FieldShell }
