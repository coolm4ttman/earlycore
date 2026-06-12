// EarlyCore brand assets — the real red-E mark + wordmark styling.

import mark from '@/assets/earlycore-mark.png'

export function LogoE({ className }: { className?: string }) {
  return <img src={mark} alt="EarlyCore" className={className} />
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-[1px] ${className ?? ''}`}>
      <span className="font-black tracking-tight text-[#e8442e]">E</span>
      <span className="text-foreground font-black tracking-tight">ARLYCORE</span>
    </span>
  )
}
