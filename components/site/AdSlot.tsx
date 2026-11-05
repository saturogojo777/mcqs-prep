/**
 * Advertising placeholder. It renders NOTHING until NEXT_PUBLIC_ADSENSE_CLIENT
 * is set in the environment, and it is never used on the quiz or result screens.
 */
export default function AdSlot({ slot }: { slot?: string }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  if (!client) return null
  return (
    <aside className="ad-slot" aria-label="Advertisement">
      <ins className="adsbygoogle" data-ad-client={client} data-ad-slot={slot ?? ''} />
    </aside>
  )
}
