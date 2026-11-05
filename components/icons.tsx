import type { SVGProps } from 'react'

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  focusable: 'false' as const,
}

type Props = SVGProps<SVGSVGElement>

export function IconLogo(props: Props) {
  return (
    <svg {...base} strokeWidth={1.8} {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14z" />
      <path d="M10 4.5h4" />
    </svg>
  )
}

export function IconLandmark(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 10h18" />
      <path d="M12 3 3 7.5h18z" />
      <path d="M6 10v7M10 10v7M14 10v7M18 10v7" />
      <path d="M3 20h18" />
    </svg>
  )
}

export function IconMountain(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 19h18L14 5l-3.5 6.5L8 8z" />
      <path d="m9.6 7.6 1.3 1.6 1.2-1.2" />
    </svg>
  )
}

export function IconGlobe(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.4 3.9 5.6 3.9 9s-1.4 6.6-3.9 9c-2.5-2.4-3.9-5.6-3.9-9S9.5 5.4 12 3z" />
    </svg>
  )
}

export function IconFlask(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 3h6" />
      <path d="M10 3v5.2L5.4 17A2 2 0 0 0 7.2 20h9.6a2 2 0 0 0 1.8-3L14 8.2V3" />
      <path d="M7.4 14h9.2" />
    </svg>
  )
}

export function IconCalculator(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path d="M8.5 7.5h7" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" />
    </svg>
  )
}

export function IconBook(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z" />
    </svg>
  )
}

export function IconCheck(props: Props) {
  return (
    <svg {...base} strokeWidth={2.2} {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  )
}

export function IconClose(props: Props) {
  return (
    <svg {...base} strokeWidth={2.2} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function IconClock(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export function IconArrowLeft(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </svg>
  )
}

export function IconArrowRight(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export function IconRestart(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5V10H9" />
    </svg>
  )
}

const TOPIC_ICONS = [IconLandmark, IconMountain, IconGlobe, IconFlask, IconCalculator, IconBook]

export function topicIcon(name: string) {
  const value = name.toLowerCase()
  if (/geo|mountain|river|desert|symbol/.test(value)) return IconMountain
  if (/organi|international|world|day|united/.test(value)) return IconGlobe
  if (/science|computer|physics|chem|bio|tech/.test(value)) return IconFlask
  if (/math|english|grammar|arithmetic|number|verbal/.test(value)) return IconCalculator
  if (/constitution|gk|general|pakistan/.test(value)) return IconLandmark
  return IconBook
}

export function TopicFallbackIcon({ index }: { index: number }) {
  const Icon = TOPIC_ICONS[index % TOPIC_ICONS.length]
  return <Icon />
}
