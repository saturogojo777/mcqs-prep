'use client'

/**
 * STEP 4B — no repeated questions for the same user, without logins.
 *
 * Every question the student is SHOWN is recorded in localStorage under
 * `dailytest.seen.v1` as `{ "<id>": { lastSeenAt, timesSeen, lastResult } }`.
 * When a test starts, the newest seen ids (oldest-first, wrong answers first)
 * ride along to `random_questions` as `p_exclude_ids`: unseen pool questions
 * come first, then the longest-ago seen ones. Nothing identifiable ever
 * leaves the browser — only question ids the server already knows.
 */

export const SEEN_KEY = 'dailytest.seen.v1'
export const TODAY_DONE_KEY = 'dailytest.today.v1'

/** Newest entries kept; older ones are pruned on every write. */
export const SEEN_CAP = 5000
/** Most ids ever sent to the server in a single call. */
export const SEEN_SEND_CAP = 1500

export type SeenResult = 'right' | 'wrong' | null

export type SeenEntry = {
  lastSeenAt: number
  timesSeen: number
  lastResult: SeenResult
}

export type SeenMap = Record<string, SeenEntry>

type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function storage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

function isEntry(value: unknown): value is SeenEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.lastSeenAt === 'number' &&
    Number.isFinite(entry.lastSeenAt) &&
    typeof entry.timesSeen === 'number' &&
    Number.isFinite(entry.timesSeen) &&
    (entry.lastResult === 'right' || entry.lastResult === 'wrong' || entry.lastResult === null)
  )
}

/** The whole seen map; corrupt or missing storage reads as empty. */
export function readSeen(): SeenMap {
  const store = storage()
  if (!store) return {}
  try {
    const raw = store.getItem(SEEN_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const clean: SeenMap = {}
    for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof id === 'string' && id && isEntry(entry)) clean[id] = entry
    }
    return clean
  } catch {
    return {}
  }
}

/** Pure: keep the `cap` newest entries by lastSeenAt. */
export function pruneSeen(seen: SeenMap, cap: number = SEEN_CAP): SeenMap {
  const ids = Object.keys(seen)
  if (ids.length <= cap) return { ...seen }
  const ordered = ids.sort((a, b) => seen[b].lastSeenAt - seen[a].lastSeenAt)
  const kept: SeenMap = {}
  for (const id of ordered.slice(0, Math.max(0, cap))) kept[id] = seen[id]
  return kept
}

function tryWrite(store: StorageLike, value: SeenMap): boolean {
  try {
    store.setItem(SEEN_KEY, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * Persist the map, capped. When storage is full the oldest half is dropped
 * and the write is retried once; a locked-down browser simply keeps nothing.
 */
export function writeSeen(seen: SeenMap): void {
  const store = storage()
  if (!store) return
  if (tryWrite(store, pruneSeen(seen))) return
  tryWrite(store, pruneSeen(seen, Math.floor(SEEN_CAP / 2)))
}

/**
 * Record that a question was SHOWN (answering is tracked separately).
 * Safe to call repeatedly; every call counts as one more viewing.
 */
export function markSeen(id: string, at: number = Date.now()): void {
  if (!id) return
  const seen = readSeen()
  const prev = seen[id]
  seen[id] = {
    lastSeenAt: at,
    timesSeen: (prev?.timesSeen ?? 0) + 1,
    lastResult: prev?.lastResult ?? null,
  }
  writeSeen(seen)
}

/**
 * Mark a whole served test seen with a single storage round-trip, so even a
 * 500-question paper starts without jank.
 */
export function markSeenMany(ids: string[], at: number = Date.now()): void {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return
  const seen = readSeen()
  for (const id of unique) {
    const prev = seen[id]
    seen[id] = {
      lastSeenAt: at,
      timesSeen: (prev?.timesSeen ?? 0) + 1,
      lastResult: prev?.lastResult ?? null,
    }
  }
  writeSeen(seen)
}

/**
 * Record how the shown question was answered. Never bumps `timesSeen` —
 * showing and answering are counted independently.
 */
export function recordSeenResult(id: string, right: boolean, at: number = Date.now()): void {
  if (!id) return
  const seen = readSeen()
  const prev = seen[id]
  seen[id] = {
    lastSeenAt: prev?.lastSeenAt ?? at,
    timesSeen: prev ? prev.timesSeen : 1,
    lastResult: right ? 'right' : 'wrong',
  }
  writeSeen(seen)
}

/** Forget every seen id in `ids` (fresh round for one pool). Returns how many went. */
export function clearSeenForIds(ids: string[]): number {
  if (ids.length === 0) return 0
  const seen = readSeen()
  let removed = 0
  for (const id of ids) {
    if (seen[id]) {
      delete seen[id]
      removed++
    }
  }
  writeSeen(seen)
  return removed
}

/** Forget the whole seen history in this browser. */
export function clearSeen(): void {
  writeSeen({})
}

/** Wrong answers resurface before right ones; ties break oldest-first. */
function compareFallback(a: SeenEntry, b: SeenEntry): number {
  const rank = (entry: SeenEntry) => (entry.lastResult === 'wrong' ? 0 : entry.lastResult === 'right' ? 2 : 1)
  return rank(a) - rank(b) || a.lastSeenAt - b.lastSeenAt
}

/**
 * Ids to send as `p_exclude_ids`: the most-recent `cap` seen ids, ordered
 * oldest-first (wrong answers ahead) so the server fills shortfalls from the
 * longest-ago seen questions. Anything older than the window counts as new.
 */
export function excludeIdsForSend(seen: SeenMap, cap: number = SEEN_SEND_CAP): string[] {
  const ids = Object.keys(seen)
  if (ids.length === 0) return []
  const recent = ids
    .sort((a, b) => seen[b].lastSeenAt - seen[a].lastSeenAt)
    .slice(0, Math.max(0, cap))
  return recent.sort((a, b) => compareFallback(seen[a], seen[b]))
}

/** Fisher-Yates with an injectable coin, so tests can run it deterministically. */
function shuffleWith<T>(list: T[], rand: () => number): T[] {
  const copy = list.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Pure test builder, mirroring the server rule: pool ids are de-duplicated,
 * unseen ids come first (shuffled), then the longest-ago seen fill the rest
 * (wrong answers ahead). Never repeats an id inside one test.
 */
export function selectTestOrder(
  poolIds: string[],
  seen: SeenMap,
  size: number,
  rand: () => number = Math.random,
): string[] {
  const unique = [...new Set(poolIds.filter((id) => typeof id === 'string' && id))]
  const wanted = Math.max(0, Math.min(size, unique.length))
  const unseen = shuffleWith(
    unique.filter((id) => !seen[id]),
    rand,
  )
  const picked = unseen.slice(0, wanted)
  if (picked.length < wanted) {
    const fallback = unique.filter((id) => seen[id]).sort((a, b) => compareFallback(seen[a], seen[b]))
    picked.push(...fallback.slice(0, wanted - picked.length))
  }
  return picked
}

/* ------------------------------------------------------------------ */
/* Today's Test completion: one card per day, instead of a re-do.      */
/* ------------------------------------------------------------------ */

export type TodayDone = { seed: string; right: number; total: number; at: number }

export function getTodayDone(seed: string): TodayDone | null {
  const store = storage()
  if (!store || !seed) return null
  try {
    const raw = store.getItem(TODAY_DONE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TodayDone> | null
    if (!parsed || parsed.seed !== seed || typeof parsed.total !== 'number') return null
    return { seed: parsed.seed, right: Number(parsed.right) || 0, total: parsed.total, at: Number(parsed.at) || 0 }
  } catch {
    return null
  }
}

export function saveTodayDone(seed: string, right: number, total: number): void {
  const store = storage()
  if (!store || !seed) return
  try {
    store.setItem(TODAY_DONE_KEY, JSON.stringify({ seed, right, total, at: Date.now() }))
  } catch {
    // a locked-down browser simply never shows the Done card
  }
}

export function clearTodayDone(): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(TODAY_DONE_KEY, '')
  } catch {
    // ignore
  }
}
