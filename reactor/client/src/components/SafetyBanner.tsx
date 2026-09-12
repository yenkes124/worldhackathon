import { ShieldAlert } from 'lucide-react'
import { useMirror } from '../state/store'

const FALLBACK =
  'NeuroGrid is a synthetic, educational world-model demo. It uses invented geometry and invented coordinates — no patient data, no anatomical accuracy, and no use for diagnosis, planning, or surgical guidance.'

export const SafetyBanner = () => {
  const notice = useMirror((s) => s.scenario?.safety_notice)
  const body = (notice ?? `Not medical software. ${FALLBACK}`).replace(/^Not medical software\.\s*/, '')
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-amber-100"
    >
      <ShieldAlert className="mt-[2px] h-4 w-4 shrink-0 text-amber-300" aria-hidden />
      <p className="text-[12px] leading-relaxed">
        <span className="font-semibold tracking-wide text-amber-200 uppercase">
          Not medical software.
        </span>{' '}
        {body}
      </p>
    </div>
  )
}
