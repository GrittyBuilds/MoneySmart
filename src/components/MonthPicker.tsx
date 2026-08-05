import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, format, startOfMonth } from 'date-fns'

export function MonthPicker({
  month,
  onChange,
}: {
  month: Date
  onChange: (d: Date) => void
}) {
  const isCurrentMonth =
    startOfMonth(month).getTime() === startOfMonth(new Date()).getTime()

  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
      <button
        onClick={() => onChange(addMonths(month, -1))}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[7.5rem] text-center text-sm font-semibold">
        {format(month, 'MMMM yyyy')}
      </span>
      <button
        onClick={() => onChange(addMonths(month, 1))}
        disabled={isCurrentMonth}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-30"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
