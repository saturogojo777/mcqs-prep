// Small, stroke-based line icons. No icon library, no extra JS on the page.
type Props = { className?: string; size?: number }

const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export function IconExam({ size }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M8 4h8a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M9.5 3h5v3h-5z" />
      <path d="M9 11h6M9 15h4" />
    </svg>
  )
}

export function IconSubject({ size }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v14H6.5A2.5 2.5 0 0 0 4 20.5Z" />
      <path d="M4 6.5V20.5" />
      <path d="M8 8h7M8 12h5" />
    </svg>
  )
}

export function IconBook({ size }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M12 6.5C10.5 5 8.5 4.5 5 4.5v13c3.5 0 5.5.5 7 2 1.5-1.5 3.5-2 7-2v-13c-3.5 0-5.5.5-7 2Z" />
      <path d="M12 6.5v13" />
    </svg>
  )
}

export function IconCalendar({ size }: Props) {
  return (
    <svg {...base(size)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
      <path d="M8 14h3v3H8z" />
    </svg>
  )
}

export function IconArrow({ size }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  )
}

export function IconBack({ size }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M19 12H6M11 6l-6 6 6 6" />
    </svg>
  )
}

export function IconCheck({ size }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  )
}

export function IconClose({ size }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function IconClock({ size }: Props) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export function IconSearch({ size }: Props) {
  return (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  )
}

export function IconFlag({ size }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M6 21V4" />
      <path d="M6 4h11l-2 4 2 4H6" />
    </svg>
  )
}

export function IconGrid({ size }: Props) {
  return (
    <svg {...base(size)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function IconChart({ size }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 16v-4M12.5 16V8M17 16v-6" />
    </svg>
  )
}

export function IconShield({ size }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M12 3l7 3v6c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

export function IconBolt({ size }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" />
    </svg>
  )
}

export function IconDevice({ size }: Props) {
  return (
    <svg {...base(size)}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M10.5 5.5h3M11 18.5h2" />
    </svg>
  )
}
