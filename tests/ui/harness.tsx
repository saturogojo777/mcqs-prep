// Headless UI test for the practice app: mounts the real component in jsdom,
// clicks real DOM buttons and asserts what a student would see.

import assert from 'node:assert/strict'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import PracticeApp from '@/components/PracticeApp'
import { CATALOG, CATEGORIES, questionsFor } from '@/tests/ui/stub-supabase'

const PROGRESS_KEY = 'mcqprep.progress.v1'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function q<T extends Element>(selector: string): T[] {
  return Array.from(document.querySelectorAll(selector)) as T[]
}

function find(selector: string, text: string): HTMLElement {
  const hit = q<HTMLElement>(selector).find((el) => textOf(el).includes(text))
  assert.ok(hit, `expected ${selector} containing "${text}"`)
  return hit!
}

async function flush(ms = 30) {
  await act(async () => {
    await sleep(ms)
  })
}

async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await flush(10)
}

function optionButtons(): HTMLElement[] {
  return q<HTMLElement>('.option')
}

function optionTexts(): string[] {
  return optionButtons().map((el) => textOf(el.querySelector('.option-text')).trim())
}

function clickOption(text: string) {
  const index = optionTexts().indexOf(text)
  assert.ok(index >= 0, `option "${text}" should be on screen (have ${optionTexts().join(' | ')})`)
  return click(optionButtons()[index])
}

function clickWrongOption(correct: string) {
  const index = optionTexts().findIndex((text) => text !== correct)
  assert.ok(index >= 0, 'a wrong option should exist')
  return click(optionButtons()[index])
}

function currentQuestionText(): string {
  return textOf(document.querySelector('.qtext')).trim()
}

function correctAnswerFor(questionText: string, categoryId: string): string {
  const row = questionsFor(categoryId).find((item) => item.question_en === questionText)
  assert.ok(row, `fixture should contain "${questionText}"`)
  return row!.correct_text
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
    await flush(60)
  }
  throw new Error(`the score ring should reach ${expected}, it stayed at "${last}"`)
}

const ISOLATE = /[\u2066-\u2069]/g
const textOf = (el: Element | null | undefined) => (el?.textContent ?? '').replace(ISOLATE, '')

const passed: string[] = []
function ok(name: string) {
  passed.push(name)
}

async function main() {
  const container = document.getElementById('root')!
  const root = createRoot(container)

  await act(async () => {
    root.render(<PracticeApp initialCatalog={CATALOG} />)
  })
  await flush(60)

  // ---------------------------------------------------------------- home
  assert.equal(q('.topic-card').length, 2, 'two topic cards are listed')
  assert.ok(textOf(document.body).includes('12 questions'), 'question counts are shown')
  assert.ok(!textOf(document.body).includes('undefined'), 'no undefined leaks into the UI')
  assert.equal(q('.resume').length, 0, 'no continue card without progress')
  ok('home lists topic cards with counts and no continue card on a fresh device')

  // ---------------------------------------------------------------- practice
  await click(q('.topic-card')[0].querySelector('.btn-practice') as HTMLElement)
  assert.equal(optionButtons().length, 4, 'four options per question')
  const firstQuestion = currentQuestionText()
  assert.ok(firstQuestion.length > 0, 'question text renders')
  assert.equal(
    textOf(document.querySelector('.quiz-counter')).trim(),
    'Question 1 of 12',
  )
  assert.equal(q('.qgrid-cell').length, 12, 'the question grid lists every question')
  assert.equal(q('.timer').length, 0, 'no timer in practice mode')
  ok('practice starts with four options, a question counter and the question grid')

  const nextButton = document.querySelector('.btn-next') as HTMLButtonElement
  assert.equal(nextButton.disabled, true, 'next is disabled before answering')
  ok('next button waits for an answer')

  await clickOption(correctAnswerFor(firstQuestion, CATEGORIES.GK))
  assert.ok(
    document.querySelector('.feedback[data-kind="correct"]'),
    'correct answer is detected by text, not by letter',
  )
  assert.ok(document.querySelector('.option[data-state="correct"] .option-mark svg'), 'check icon')
  let progress = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? '{}')
  assert.equal(progress[CATEGORIES.GK].answered, 1)
  assert.equal(progress[CATEGORIES.GK].correct, 1)
  ok('correct pick is detected after shuffling, marked with a check icon and saved')

  await clickNext()
  const secondQuestion = currentQuestionText()
  assert.notEqual(secondQuestion, firstQuestion, 'next question is shown')
  const secondCorrect = correctAnswerFor(secondQuestion, CATEGORIES.GK)
  await clickWrongOption(secondCorrect)
  const wrongFeedback = document.querySelector('.feedback[data-kind="wrong"]')
  assert.ok(wrongFeedback, 'wrong pick shows the wrong state')
  assert.ok(textOf(wrongFeedback!).includes(secondCorrect), 'correct answer is revealed')
  assert.ok(document.querySelector('.option[data-state="wrong"]'), 'the wrong pick is marked')
  assert.ok(
    document.querySelectorAll('.option[data-state="correct"]').length === 1,
    'exactly one option is revealed as correct',
  )
  progress = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? '{}')
  assert.equal(progress[CATEGORIES.GK].answered, 2)
  assert.equal(progress[CATEGORIES.GK].correct, 1)
  ok('wrong pick is marked, reveals the right answer and does not count as correct')

  const lockedCount = optionButtons().filter((el) => (el as HTMLButtonElement).disabled).length
  assert.equal(lockedCount, 4, 'options lock once answered')
  ok('options lock after answering')

  // ---------------------------------------------------------------- Urdu
  await click(document.querySelector('.lang-toggle')!)
  assert.equal(document.documentElement.dir, 'rtl', 'Urdu switches the document to RTL')
  assert.equal(document.documentElement.lang, 'ur')
  assert.ok(document.querySelector('.qtext.urdu'), 'Urdu question uses the Nastaliq style')
  const urduText = currentQuestionText()
  assert.ok(/[\u0600-\u06FF]/.test(urduText), 'Urdu question text is rendered')
  assert.ok(document.querySelector('.feedback'), 'feedback still visible after language switch')
  ok('Urdu toggle renders RTL Nastaliq questions')

  await click(document.querySelector('.lang-toggle')!)
  assert.equal(document.documentElement.dir, 'ltr')
  ok('English toggle restores LTR')

  // ---------------------------------------------------------------- back to home mid-topic
  await click(document.querySelector('.btn-back')!)
  assert.equal(q('.topic-card').length, 2, 'back on the home screen')
  const statValues = q('.stat-value').map((el) => textOf(el).trim())
  assert.deepEqual(statValues, ['2', '50%'], 'answered total and accuracy come from localStorage')
  assert.ok(document.querySelector('.resume'), 'the continue card appears once there is progress')
  assert.ok(textOf(document.querySelector('.resume-meta')).includes('2 of 12'))
  ok('home shows saved stats and the continue card mid-topic')

  // ---------------------------------------------------------------- continue
  await click(document.querySelector('.btn-continue')!)
  assert.ok(document.querySelector('.qtext'), 'continue opens the quiz')
  assert.equal(
    textOf(document.querySelector('.quiz-counter')).trim(),
    'Question 3 of 12',
    'continue resumes where the student stopped',
  )
  ok('the continue card resumes the topic at the saved question')

  // ---------------------------------------------------------------- finish practice
  let guard = 0
  while (!document.querySelector('.result-percent') && guard < 20) {
    const text = currentQuestionText()
    await clickOption(correctAnswerFor(text, CATEGORIES.GK))
    await clickNext()
    guard++
  }
  assert.ok(document.querySelector('.result-percent'), 'practice finishes with a score ring')
  await waitForPercent('100%') // the ring counts up to the final score
  const percentText = textOf(document.querySelector('.result-percent')).trim()
  assert.equal(percentText, '100%', 'the resumed session scored 10 out of 10')
  assert.equal(q('.review-item').length, 0, 'a clean session has no review items')
  assert.ok(textOf(document.body).includes('No mistakes'))
  ok('practice runs to the end of the topic and shows a score ring')

  await click(document.querySelector('.btn-home')!)
  assert.equal(q('.resume').length, 0, 'a finished topic has nothing to continue')
  ok('the continue card hides once the topic is finished')

  // ---------------------------------------------------------------- test mode
  await click(q('.topic-card')[0].querySelector('.btn-test') as HTMLElement)
  assert.equal(
    textOf(document.querySelector('.quiz-counter')).trim(),
    'Question 1 of 10',
    'test asks 10 questions',
  )
  assert.ok(document.querySelector('.timer'), 'the test shows a timer')
  assert.equal(q('.btn-next').length, 1, 'the test has a next button')

  const seen: string[] = []
  for (let i = 0; i < 10; i++) {
    const text = currentQuestionText()
    seen.push(text)
    const correct = correctAnswerFor(text, CATEGORIES.GK)
    if (i < 3) await clickOption(correct)
    else await clickWrongOption(correct)
    assert.equal(document.querySelector('.feedback'), null, 'no feedback is shown during a test')
    await clickNext()
  }

  assert.equal(new Set(seen).size, 10, 'ten different questions were asked')
  await waitForPercent('30%')
  const score = textOf(document.querySelector('.result-percent')).trim()
  assert.equal(score, '30%', `score should be 30%, got "${score}"`)
  assert.equal(q('.review-item').length, 7, 'review lists the seven missed questions')
  const counts = q('.result-count strong').map((el) => textOf(el).trim())
  assert.deepEqual(counts, ['3', '7'], 'correct and wrong counts are shown')
  ok('test mode asks 10 random questions, hides feedback and scores 3/10')

  // ---------------------------------------------------------------- retry
  await click(document.querySelector('.btn-retry')!)
  assert.equal(
    textOf(document.querySelector('.quiz-counter')).trim(),
    'Question 1 of 10',
    'retry starts a fresh test',
  )
  ok('retry starts a fresh test')

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
