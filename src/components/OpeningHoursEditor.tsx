import { Clock } from 'lucide-react'
import type { OpeningHours } from '../types'
import { WEEKDAYS, DEFAULT_OPENING_HOURS } from '../domain/constants'

export function OpeningHoursEditor({
  value,
  onChange,
}: {
  value: OpeningHours
  onChange: (value: OpeningHours) => void
}) {
  const updateDay = (day: string, patch: Partial<OpeningHours[string]>) => {
    const current = value[day] ?? DEFAULT_OPENING_HOURS[day]
    onChange({ ...value, [day]: { ...current, ...patch } })
  }

  return (
    <div className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200">
      {WEEKDAYS.map((day) => {
        const hours = value[day.value] ?? DEFAULT_OPENING_HOURS[day.value]
        return (
          <div
            key={day.value}
            className="flex flex-wrap items-center gap-3 bg-white px-3 py-2.5 sm:flex-nowrap"
          >
            <div className="flex min-w-[110px] items-center gap-2">
              <Clock className="h-4 w-4 text-stone-400" />
              <span className="text-sm font-medium text-stone-700">{day.label}</span>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-500">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                checked={!hours.closed}
                onChange={(event) =>
                  updateDay(day.value, { closed: !event.target.checked })
                }
              />
              Aberto
            </label>

            {hours.closed ? (
              <span className="text-sm text-stone-400">Fechado</span>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={hours.open}
                  onChange={(event) => updateDay(day.value, { open: event.target.value })}
                  className="h-9 rounded-lg border border-stone-300 px-2 text-sm text-stone-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
                <span className="text-xs text-stone-400">até</span>
                <input
                  type="time"
                  value={hours.close}
                  onChange={(event) => updateDay(day.value, { close: event.target.value })}
                  className="h-9 rounded-lg border border-stone-300 px-2 text-sm text-stone-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
