// Headless UI test: mounts the real DailyTest practice flow in jsdom, clicks
// real DOM buttons and asserts what a student would see.

import assert from 'node:assert/strict'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import PracticeFlow from '@/components/PracticeFlow'
import { applyLang } from '@/components/i18n'
import { prepareQuestion } from '@/lib/catalog'
import { shuffle } from '@/lib/session'
import { QUESTION_COUNT, QUESTIONS, SUBJECT, correctFor } from '@/tests/ui/stub-supabase'

const MISTAKES_KEY = 'dailytest.mistakes.v1'
const LAST_KEY = 'dailytest.last.v1'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const ISOLATE = /[\u2066-\u2069]/g
const textOf = (el: Element | null | undefined) => (el?.textContent ?? '').replace(ISOLATE, '')

function q<T extends Element>(selector: string): T[] {
  return Array.from(document.querySelectorAll(selector)) as T[]
}

async function flush(ms = 25) {
  await act(async () => {
    await sleep(ms)
  })
}

async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await flush(12)
}

const optionButtons = () => q<HTMLButtonElement>('.option')
const optionTexts = () => optionButtons().map((el) => textOf(el.querySelector('.option-text')).trim())
const questionText = () => textOf(document.querySelector('.qtext')).trim()
const counter = () =>
  textOf(document.querySelector('.quiz-counter .t-en') ?? document.querySelector('.quiz-counter')).trim()

async function clickOption(text: string) {
  const index = optionTexts().indexOf(text)
  assert.ok(index >= 0, `option "${text}" should be on screen (have ${optionTexts().join(' | ')})`)
  await click(optionButtons()[index])
}

async function clickWrongOption(correct: string) {
  const index = optionTexts().findIndex((text) => text !== correct)
  assert.ok(index >= 0, 'a wrong option should exist')
  await click(optionButtons()[index])
}

async function clickNext() {
  const button = document.querySelector('.btn-next') as HTMLButtonElement | null
  assert.ok(button, 'the next button should be on screen')
  await click(button!)
}

async function waitForPercent(expected: string, timeout = 4000) {
  const started = Date.now()
  let last = ''
  while (Date.now() - started < timeout) {
    last = textOf(document.querySelector('.result-percent')).trim()
    if (last === expected) return
    await flush(50)
  }
  throw new Error(`the score ring should reach ${expected}, it stayed at "${last}"`)
}

const passed: string[] = []
const ok = (name: string) => passed.push(name)

function storage<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? '') as T
  } catch {
    return fallback
  }
}

async function render(available = QUESTION_COUNT) {
  const container = document.getElementById('root')!
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <PracticeFlow mode="subject" title="General Knowledge" titleUr="عمومی معلومات" itemKey={SUBJECT} available={available} />,
    )
  })
  await flush(50)
  return root
}

async function main() {
  window.localStorage.clear()
  let root = await render()

  // ------------------------------------------------------------- start screen
  assert.ok(textOf(document.body).includes('General Knowledge'), 'the picked subject is named')
  assert.ok(/How many questions\?/.test(textOf(document.body)), 'the number picker is shown')
  assert.ok(q('.chip').length >= 2, 'size choices are offered')
  assert.equal(q('.switch').length, 1, 'the timer switch exists')
  const sizes = q('.chip').map((el) => textOf(el).trim())
  assert.deepEqual(sizes, ['10', '12'], `sizes should respect the available count, got ${sizes.join(',')}`)
  ok('start screen names the pick, offers sizes that fit and a timer switch')

  const startButton = document.querySelector('.btn-start') as HTMLButtonElement
  assert.ok(startButton && !startButton.disabled, 'the start button is ready')
  assert.equal(document.querySelector('.quiz'), null, 'no quiz before start')
  ok('start button is enabled and the quiz has not begun yet')

  // ------------------------------------------------------------- first question
  await click(startButton)
  assert.equal(optionButtons().length, 4, 'four options per question')
  assert.equal(counter(), 'Question 1 of 10', 'the counter shows position and total')
  assert.equal(document.querySelector('.quiz-timer'), null, 'no timer when it is switched off')
  assert.ok(questionText().length > 0, 'the question text renders')
  assert.equal((document.querySelector('.btn-next') as HTMLButtonElement).disabled, true, 'next waits for an answer')
  ok('the quiz shows one question, four options, a counter and a disabled next button')

  const firstText = questionText()
  const firstCorrect = correctFor(firstText)
  const row = QUESTIONS.find((entry) => entry.question_en === firstText)!
  const letters = row.options
  const shown = optionTexts().slice().sort()
  assert.deepEqual(shown, [letters.A, letters.B, letters.C, letters.D].sort(), 'all four options are shown')
  const orders = new Set<string>()
  for (let i = 0; i < 24; i++) orders.add(prepareQuestion(row, shuffle).displayOptions.join('|'))
  assert.ok(orders.size > 1, 'the same question never stops being shuffled')
  ok('options are all present and shuffled on every display')

  // ------------------------------------------------------------- correct answer
  await clickOption(firstCorrect)
  assert.ok(document.querySelector('.feedback[data-kind="correct"]'), 'a correct pick is detected by option text')
  assert.ok(document.querySelector('.option[data-state="correct"] .option-mark svg'), 'the right option gets a check')
  assert.equal(optionButtons().filter((el) => el.disabled).length, 4, 'options lock after answering')
  assert.equal((document.querySelector('.btn-next') as HTMLButtonElement).disabled, false, 'next unlocks')
  ok('a correct pick is recognised by text, marked green and locks the options')

  // ------------------------------------------------------------- wrong answer
  await clickNext()
  assert.equal(counter(), 'Question 2 of 10', 'next moves to the second question')
  const secondText = questionText()
  assert.notEqual(secondText, firstText, 'a different question is shown')
  const secondCorrect = correctFor(secondText)
  await clickWrongOption(secondCorrect)
  const feedback = document.querySelector('.feedback[data-kind="wrong"]')
  assert.ok(feedback, 'a wrong pick shows the wrong state')
  assert.ok(textOf(feedback!).includes(secondCorrect), 'the correct answer is revealed')
  assert.equal(q('.option[data-state="correct"]').length, 1, 'exactly one option is revealed as correct')
  assert.ok(document.querySelector('.option[data-state="wrong"]'), 'the wrong pick is marked')
  ok('a wrong pick is marked red, reveals the right answer and cannot be changed')

  // ------------------------------------------------------------- Urdu
  await act(async () => {
    applyLang('ur')
  })
  await flush(20)
  assert.equal(document.documentElement.dir, 'rtl', 'Urdu switches the document to RTL')
  assert.equal(document.documentElement.lang, 'ur', 'the document language becomes Urdu')
  assert.ok(document.querySelector('.qtext--ur'), 'the Urdu question uses the Nastaliq style')
  assert.ok(/[\u0600-\u06FF]/.test(questionText()), 'Urdu question text is rendered')
  assert.ok(document.querySelector('.feedback'), 'feedback survives the language switch')
  ok('Urdu turns the page RTL and renders the Nastaliq question')

  await act(async () => {
    applyLang('en')
  })
  await flush(20)
  assert.equal(document.documentElement.dir, 'ltr', 'English restores LTR')
  ok('switching back restores English and LTR')

  // ------------------------------------------------------------- finish to the end
  let guard = 0
  while (!document.querySelector('.result-percent') && guard < 20) {
    if (!document.querySelector('.feedback')) {
      const correct = correctFor(questionText())
      await clickOption(correct)
    }
    await clickNext()
    guard++
  }
  assert.ok(document.querySelector('.result-percent'), 'the result screen appears at the end')
  await waitForPercent('90%')
  assert.equal(q('.review-item').length, 1, 'the one missed question is listed for review')
  assert.ok(q('.review-item')[0].querySelector('.review-row--right'), 'the review shows the right answer')
  const facts = q('.fact-value').map((el) => textOf(el).trim())
  assert.deepEqual(facts.slice(0, 2), ['9', '1'], 'the result shows the right and wrong counts')
  ok('the run ends with a score ring, facts and a review of the missed question')

  const mistakes = storage<string[]>(MISTAKES_KEY, [])
  assert.equal(mistakes.length, 1, 'the missed question is remembered locally')
  const last = storage<{ right: number; total: number } | null>(LAST_KEY, null)
  assert.equal(last?.total, 10, 'the last result is stored for the home screen')
  ok('mistakes and the last result are saved in localStorage only')

  // ------------------------------------------------------------- practice my mistakes
  const mistakesButton = document.querySelector('.btn-mistakes') as HTMLButtonElement
  assert.ok(mistakesButton, 'the mistakes button is offered after a wrong answer')
  await click(mistakesButton)
  assert.equal(counter(), 'Question 1 of 1', 'only the missed question is asked again')
  assert.equal(questionText(), secondText, 'the missed question is the one that comes back')
  ok('"Practise my mistakes" replays exactly the questions answered wrongly')

  // ------------------------------------------------------------- try again
  await clickOption(correctFor(questionText()))
  await clickNext()
  await waitForPercent('100%')
  assert.equal(q('.review-item').length, 0, 'a clean run has no review items')
  assert.ok(textOf(document.body).includes('No mistakes'), 'a clean run says so')
  assert.equal(storage<string[]>(MISTAKES_KEY, []).length, 0, 'fixing the mistake clears it from storage')
  ok('a clean run shows 100% with no review items and clears the mistake')

  await click(document.querySelector('.btn-try-again')!)
  assert.ok(document.querySelector('.btn-start'), 'try again returns to the setup screen')
  assert.equal(document.querySelector('.result-percent'), null, 'the result screen is gone')
  ok('"Try again" goes back to the setup screen')

  // ------------------------------------------------------------- timer + custom size
  await click(document.querySelector('.switch')!)
  await click(q('.chip')[0])
  await click(document.querySelector('.btn-start')!)
  assert.ok(document.querySelector('.quiz-timer'), 'the timer appears once it is switched on')
  assert.match(textOf(document.querySelector('.quiz-timer')).trim(), /^\d{2}:\d{2}$/, 'the clock is mm:ss')
  assert.equal(counter(), 'Question 1 of 10', 'the picked size is used')
  ok('the timer switch shows a running mm:ss clock and the chosen size is respected')

  await click(document.querySelector('.icon-btn')!)
  assert.ok(document.querySelector('.btn-start'), 'exiting the quiz returns to setup')
  const input = document.querySelector('.chip-input') as HTMLInputElement
  assert.ok(input, 'a custom number field is offered')
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, '999')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await flush(20)
  await click(document.querySelector('.btn-start')!)
  assert.equal(counter(), 'Question 1 of 12', 'a custom number above the pool is clamped to what exists')
  ok('a custom number bigger than the pool is clamped to the available questions')

  // ------------------------------------------------------------- mock test mode
  const exitButton = document.querySelector('.icon-btn')
  if (exitButton) await click(exitButton)
  const mockTab = q<HTMLButtonElement>('.seg-btn').find((el) => textOf(el).trim() === 'Mock Test')
  assert.ok(mockTab, 'the mock test mode is offered')
  await click(mockTab!)
  assert.ok(document.querySelector('.pattern'), 'the test pattern is shown before starting')
  await click(document.querySelector('.btn-start')!)
  assert.ok(document.querySelector('.mock'), 'mock mode renders the exam-hall layout')
  assert.equal(q('.palette-btn').length, 10, 'the palette has one button per question')
  assert.ok(document.querySelector('.mock-timer'), 'the mock test counts down')
  await click(optionButtons()[0])
  let legend = q('.palette-legend dd').map((el) => textOf(el).trim())
  assert.equal(legend[0], '1', 'a picked option counts as answered')
  assert.equal(legend[2], '9', 'the rest stay unanswered')
  await click(document.querySelector('.mock-mark')!)
  legend = q('.palette-legend dd').map((el) => textOf(el).trim())
  assert.equal(legend[1], '1', 'mark for review is counted in the palette legend')
  assert.equal(q('.palette-btn[data-state="current"]').length, 1, 'the palette shows where you are')
  await click(document.querySelector('.btn-submit')!)
  assert.ok(document.querySelector('.dialog'), 'submitting asks for confirmation first')
  await click(document.querySelector('.btn-submit-yes')!)
  assert.ok(document.querySelector('.result-percent'), 'a mock test ends on the result screen')
  assert.equal(q('.fact').length, 4, 'the mock result adds a marks fact')
  assert.ok(document.querySelector('.mock-verdict'), 'the result states pass or below passing')
  assert.ok(document.querySelector('.bars'), 'accuracy bars are shown')
  ok('mock mode runs with a palette, confirmation, marks and pass line')

  await act(async () => {
    root.unmount()
  })

  console.log(`\nUI checks passed (${passed.length}):`)
  for (const name of passed) console.log(`  ✓ ${name}`)
  console.log('\nUI TESTS PASSED')
  process.exit(0)
}

main().catch((error) => {
  console.error('\nUI TESTS FAILED')
  console.error(error)
  process.exit(1)
})
