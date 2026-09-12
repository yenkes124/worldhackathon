import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  icon: LucideIcon
  children: ReactNode
  action?: ReactNode
}

export const Panel = ({ title, icon: Icon, children, action }: PanelProps) => (
  <section className="glass rounded-2xl p-4">
    <header className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
        <Icon className="h-3.5 w-3.5 text-sky-400" aria-hidden />
        {title}
      </h2>
      {action}
    </header>
    {children}
  </section>
)
