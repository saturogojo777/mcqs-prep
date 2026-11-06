// STEP 4B: no repeated questions. The pure selector plus the localStorage
// seen-store behind it.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  SEEN_CAP,
  SEEN_SEND_CAP,
  clearSeen,
  clearSeenForIds,
  excludeIdsForSend,
  markSeen,
  markSeenMany,
  pruneSeen,
  readSeen,
  recordSeenResult,
  selectTestOrder,
  writeSeen,
  type SeenMap,
} from '../lib/seen.ts'

/** Deterministic coin for repeatable shuffles. */
function rigged() {
  let state = 42
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

const poolOf = (n: number, prefix = 'q') => Array.from({ length: n }, (_, i) => `${prefix}-${i + 1}`)

/** Play `sizes` tests back to back, marking everything shown as seen. */
function playRounds(pool: string[], sizes: number[], wrong: Set<string> = new Set()) {
  let seen: SeenMap = {}
  let clock = 1000
  const rounds: string[][] = []
  for (const size of sizes) {
    const picked = selectTestOrder(pool, seen, size, rigged())
    rounds.push(picked)
    for (const id of picked) {
      clock += 1
      seen = {
        ...seen,
        [id]: {
          lastSeenAt: clock,
          timesSeen: (seen[id]?.timesSeen ?? 0) + 1,
          lastResult: wrong.has(id) ? 'wrong' : 'right',
        },
      }
    }
  }
  return { rounds, seen }
}

const repeatsAcross = (rounds: string[][]) => {
  const flat = rounds.flat()
  return flat.length - new Set(flat).size
}

test('three tests of 10 from a pool of 40 share no question', () => {
  const { rounds } = playRounds(poolOf(40), [10, 10, 10])
  for (const round of rounds) {
    assert.equal(round.length, 10)
    assert.equal(new Set(round).size, 10, 'never a duplicate inside one test')
  }
  assert.equal(repeatsAcross(rounds), 0, 'nothing repeats across the three tests')
})

test('a 12-pool serves unseen first, then the oldest-seen, over three tests of 10', () => {
  const pool = poolOf(12)
  const { rounds } = playRounds(pool, [10, 10, 10])
  const [first, second, third] = rounds
  assert.equal(repeatsAcross([first]), 0)
  const unseenAfterFirst = pool.filter((id) => !first.includes(id))
  assert.equal(unseenAfterFirst.length, 2)
  assert.deepEqual(second.slice(0, 2).sort(), unseenAfterFirst.sort(), 'the second test opens with the not-yet-seen')
  assert.equal(new Set(second).size, 10, 'still no duplicate inside the test')
  // The third test has nothing unseen left: the ten longest-ago seen fill it.
  assert.equal(new Set(third).size, 10)
  assert.deepEqual(
    third.slice(0, 2).sort(),
    first.slice(8, 10).sort(),
    'with nothing unseen, the two longest-unshown questions come back first',
  )
})

test('wrong answers resurface before right ones in the fill', () => {
  const pool = poolOf(6)
  // Everything seen long ago and right, except q-6: seen most recently but wrong.
  const seen: SeenMap = {}
  pool.forEach((id, i) => {
    seen[id] = { lastSeenAt: 1000 + i, timesSeen: 1, lastResult: id === 'q-6' ? 'wrong' : 'right' }
  })
  const picked = selectTestOrder(pool, seen, 3, rigged())
  assert.equal(picked[0], 'q-6', 'the wrong answer jumps the queue despite being newest')
  assert.deepEqual(picked.slice(1), ['q-1', 'q-2'], 'then the oldest-seen follow in order')
})

test('pool ids are de-duplicated before a test is built', () => {
  const picked = selectTestOrder(['q-1', 'q-1', 'q-2', 'q-2', 'q-3'], {}, 5, rigged())
  assert.equal(new Set(picked).size, picked.length)
  assert.equal(picked.length, 3, 'a question in two books still counts once')
})

test('five tests of 10 from a pool of 50 have a zero repeat rate', () => {
  const { rounds } = playRounds(poolOf(50), [10, 10, 10, 10, 10])
  const asked = rounds.flat().length
  assert.equal(asked, 50)
  assert.equal(repeatsAcross(rounds), 0, 'measured repeat rate over 5 tests: 0 of 50')
})

test('a sixth test from an exhausted pool of 50 repeats the oldest first', () => {
  const { rounds } = playRounds(poolOf(50), [10, 10, 10, 10, 10, 10])
  const sixth = rounds[5]
  assert.equal(sixth.length, 10)
  assert.deepEqual(
    [...sixth].sort(),
    [...rounds[0]].sort(),
    'with the pool exhausted, the whole first test comes back, oldest first',
  )
})

/* ------------------------------------------------------------------ */
/* The localStorage store behind the selector.                         */
/* ------------------------------------------------------------------ */

type FakeStore = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function installFakeStorage(cells: Map<string, string> = new Map(), onSet?: (key: string, value: string) => void) {
  const fake: FakeStore = {
    getItem: (key) => cells.get(key) ?? null,
    setItem: (key, value) => {
      onSet?.(key, value)
      cells.set(key, value)
    },
  }
  ;(globalThis as Record<string, unknown>).window = { localStorage: fake }
  return cells
}

function uninstallFakeStorage() {
  delete (globalThis as Record<string, unknown>).window
}

test('seen entries keep lastSeenAt, timesSeen and lastResult', () => {
  installFakeStorage()
  try {
    markSeen('q-1', 1000)
    markSeen('q-1', 2000)
    recordSeenResult('q-1', false, 2500)
    markSeen('q-2', 3000)
    assert.deepEqual(readSeen(), {
      'q-1': { lastSeenAt: 2000, timesSeen: 2, lastResult: 'wrong' },
      'q-2': { lastSeenAt: 3000, timesSeen: 1, lastResult: null },
    })
  } finally {
    uninstallFakeStorage()
  }
})

test('a served test is marked seen in one write', () => {
  const writes: string[] = []
  installFakeStorage(new Map(), (_key, value) => writes.push(value))
  try {
    markSeenMany(['q-1', 'q-2', 'q-2', 'q-3'], 900)
    assert.equal(writes.length, 1, 'a single storage write for the whole test')
    assert.deepEqual(Object.keys(readSeen()).sort(), ['q-1', 'q-2', 'q-3'])
    assert.equal(readSeen()['q-2'].timesSeen, 1, 'duplicates in one test count once')
  } finally {
    uninstallFakeStorage()
  }
})

test('a fresh round clears seen only for that pool', () => {
  installFakeStorage()
  try {
    writeSeen({
      'q-1': { lastSeenAt: 1, timesSeen: 1, lastResult: 'right' },
      'q-2': { lastSeenAt: 2, timesSeen: 1, lastResult: 'wrong' },
      'other-9': { lastSeenAt: 3, timesSeen: 1, lastResult: 'right' },
    })
    assert.equal(clearSeenForIds(['q-1', 'q-2']), 2)
    assert.deepEqual(Object.keys(readSeen()), ['other-9'])
    clearSeen()
    assert.deepEqual(readSeen(), {})
  } finally {
    uninstallFakeStorage()
  }
})

test(`the store keeps the newest ${SEEN_CAP} ids`, () => {
  const big: SeenMap = {}
  for (let i = 1; i <= SEEN_CAP + 5; i++) {
    big[`q-${i}`] = { lastSeenAt: i, timesSeen: 1, lastResult: 'right' }
  }
  const pruned = pruneSeen(big)
  assert.equal(Object.keys(pruned).length, SEEN_CAP)
  assert.ok(!pruned['q-1'] && !pruned['q-5'], 'the oldest go first')
  assert.ok(pruned[`q-${SEEN_CAP + 5}`], 'the newest stay')
})

test(`the payload sends the newest ${SEEN_SEND_CAP} ids, oldest-first`, () => {
  const big: SeenMap = {}
  for (let i = 1; i <= SEEN_SEND_CAP + 100; i++) {
    big[`q-${i}`] = { lastSeenAt: i, timesSeen: 1, lastResult: 'right' }
  }
  big['q-1600'].lastResult = 'wrong'
  const payload = excludeIdsForSend(big)
  assert.equal(payload.length, SEEN_SEND_CAP)
  assert.equal(payload[0], 'q-1600', 'the wrong answer leads the fallback order')
  assert.equal(payload[1], 'q-101', 'then the oldest of the window')
  assert.ok(!payload.includes('q-1'), 'ids older than the window count as new')
})

test('seen storage survives a reload and tolerates broken storage', () => {
  const cells = installFakeStorage()
  try {
    markSeen('q-7', 500)
    assert.deepEqual(readSeen()['q-7'], { lastSeenAt: 500, timesSeen: 1, lastResult: null })
    // A "reload" is just another read from the same cells.
    assert.deepEqual(readSeen()['q-7'], { lastSeenAt: 500, timesSeen: 1, lastResult: null })
    cells.set('dailytest.seen.v1', 'not json{{{')
    assert.deepEqual(readSeen(), {}, 'corrupt storage reads as empty')
  } finally {
    uninstallFakeStorage()
  }
})

test('a full or missing store never throws', () => {
  installFakeStorage(new Map(), () => {
    throw new Error('QuotaExceededError')
  })
  try {
    assert.doesNotThrow(() => markSeen('q-1', 1))
    assert.doesNotThrow(() => recordSeenResult('q-1', true, 2))
    assert.doesNotThrow(() => clearSeenForIds(['q-1']))
  } finally {
    uninstallFakeStorage()
  }
  assert.doesNotThrow(() => markSeen('q-1', 1), 'no window at all is fine too')
  assert.deepEqual(readSeen(), {})
})
