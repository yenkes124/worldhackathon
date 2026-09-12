import { Palette } from 'lucide-react'
import { useMirror } from '../state/store'
import { Panel } from './Panel'

export const LegendPanel = () => {
  const legend = useMirror((s) => s.scenario?.legend)
  if (!legend) return null
  return (
    <Panel title="Cell legend" icon={Palette}>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {legend.map((meta) => (
          <li key={meta.type} className="flex items-center gap-2" title={meta.description}>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: meta.color }}
            />
            <span className="truncate font-mono text-[10.5px] text-slate-300">{meta.type}</span>
            {meta.noGo && (
              <span className="ml-auto text-[9px] tracking-wide text-rose-300/80 uppercase">
                no-go
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10.5px] leading-relaxed text-slate-500">
        Axes — x: 0 left → 3 right · y: 0 anterior → 3 posterior · z: 0 inferior → 3 superior.
      </p>
    </Panel>
  )
}
