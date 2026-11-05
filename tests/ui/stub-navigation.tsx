// Minimal stand-ins for the Next.js router modules, so the real components can
// be mounted in jsdom without the app router.
export const pushed: string[] = []

export function useRouter() {
  return {
    push: (href: string) => pushed.push(href),
    replace: (href: string) => pushed.push(href),
    back: () => pushed.push('back'),
    prefetch: () => undefined,
    refresh: () => undefined,
  }
}

export function usePathname() {
  return '/'
}

export function useSearchParams() {
  return new URLSearchParams()
}
