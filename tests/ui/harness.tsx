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
  const hit = q<HTMLElement>(selector).find((el) => (el.textContent ?? '').includes(text))
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

function clickOption(text: string) {
  const option = optionButtons().find((el) => (el.textContent ?? '').includes(text))
  assert.ok(option, `option "${text}" should be on screen`)
  return click(option)
}

function currentQuestionText(): string {
  return (document.querySelector('.qtext')?.textContent ?? '').trim()
}

function correctAnswerFor(questionText: string, categoryId: string): string {
  const row = questionsFor(categoryId).find((item) => item.question_en === questionText)
  assert.ok(row, `fixture should contain "${questionText}"`)
  return row!.correct_text
}

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
  assert.equal(q('.cat').length, 2, 'two categories are listed')
  assert.ok(document.body.textContent?.includes('12 questions'))
  assert.ok(!document.body.textContent?.includes('undefined'), 'no undefined leaks into the UI')
  ok('home lists categories with question counts')

  // ---------------------------------------------------------------- practice
  await click(find('.cat', 'Pakistan GK'))
  assert.equal(optionButtons().length, 4, 'four options per question')
  const firstQuestion = currentQuestionText()
  assert.ok(firstQuestion.length > 0, 'question text renders')
  ok('practice starts and renders four options')

  // answer correctly, matched by option text (options are shuffled)
  await clickOption(correctAnswerFor(firstQuestion, CATEGORIES.GK))
  assert.ok(
    document.querySelector('.feedback[data-kind="correct"]'),
    'correct answer is detected by text, not by letter',
  )
  let progress = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? '{}')
  assert.equal(progress[CATEGORIES.GK].answered, 1)
  assert.equal(progress[CATEGORIES.GK].correct, 1)
  ok('correct pick is detected after shuffling and saved to localStorage')

  await click(find('.primary', 'Next'))
  const secondQuestion = currentQuestionText()
  assert.notEqual(secondQuestion, firstQuestion, 'next question is shown')
  const secondCorrect = correctAnswerFor(secondQuestion, CATEGORIES.GK)
  const wrongOption = optionButtons()
    .map((el) => (el.textContent ?? '').slice(1))
    .find((text) => !text.includes(secondCorrect))
  await clickOption(wrongOption!)
  const wrongFeedback = document.querySelector('.feedback[data-kind="wrong"]')
  assert.ok(wrongFeedback, 'wrong pick shows the wrong state')
  assert.ok((wrongFeedback!.textContent ?? '').includes(secondCorrect), 'correct answer is revealed')
  progress = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? '{}')
  assert.equal(progress[CATEGORIES.GK].answered, 2)
  assert.equal(progress[CATEGORIES.GK].correct, 1)
  ok('wrong pick shows the right answer and does not count as correct')

  // options are locked after answering
  const lockedCount = optionButtons().filter((el) => (el as HTMLButtonElement).disabled).length
  assert.equal(lockedCount, 4, 'options lock once answered')
  ok('options lock after answering')

  // ---------------------------------------------------------------- Urdu
  await click(document.querySelector('.lang-toggle')!)
  assert.equal(document.documentElement.dir, 'rtl', 'Urdu switches the document to RTL')
  assert.equal(document.documentElement.lang, 'ur')
  assert.ok(document.querySelector('.qtext.urdu-text'), 'Urdu question uses the Nastaliq style')
  const urduText = currentQuestionText()
  assert.ok(/[\u0600-\u06FF]/.test(urduText), 'Urdu question text is rendered')
  assert.ok(document.querySelector('.feedback'), 'feedback still visible after language switch')
  ok('Urdu toggle renders RTL Nastaliq questions')

  // back to English for the rest
  await click(document.querySelector('.lang-toggle')!)
  assert.equal(document.documentElement.dir, 'ltr')
  ok('English toggle restores LTR')

  // ---------------------------------------------------------------- finish practice
  await click(find('.primary', 'Next'))
  let guard = 0
  while (document.querySelector('.qtext') && guard < 20) {
    const text = currentQuestionText()
    await clickOption(correctAnswerFor(text, CATEGORIES.GK))
    const button = document.querySelector('.primary') as HTMLElement | null
    assert.ok(button, 'a next/see-results button is available')
    await click(button!)
    guard++
  }
  assert.ok(document.body.textContent?.includes('You reached the end of this topic.'))
  assert.ok(document.querySelector('.result .score'), 'practice finishes with a score card')
  ok('practice runs to the end of the category and shows a score')

  // ---------------------------------------------------------------- home stats
  await click(find('.primary', 'Change topic'))
  const statsShown = document.body.textContent ?? ''
  assert.ok(/12 answered/.test(statsShown), 'home shows the saved progress')
  assert.ok(!document.querySelector('.qtext'), 'back on the home screen')
  ok('home shows saved progress after a practice run')

  // ---------------------------------------------------------------- test mode
  await click(find('.segmented button', 'Test'))
  assert.ok(document.body.textContent?.includes('10 random questions'))
  await click(find('.cat', 'Pakistan GK'))
  assert.ok(document.body.textContent?.includes('1 / 10'), 'test starts with 10 questions')

  const seen: string[] = []
  for (let i = 0; i < 10; i++) {
    const text = currentQuestionText()
    seen.push(text)
    const correct = correctAnswerFor(text, CATEGORIES.GK)
    if (i < 3) {
      await clickOption(correct)
    } else {
      const wrong = optionButtons()
        .map((el) => (el.textContent ?? '').slice(1))
        .find((option) => !option.includes(correct))
      await clickOption(wrong!)
    }
    // test mode gives no feedback and advances on its own
    assert.equal(
      document.querySelector('.feedback'),
      null,
      'no feedback is shown during a test',
    )
    await flush(220)
  }

  assert.equal(new Set(seen).size, 10, 'ten different questions were asked')
  assert.ok(document.body.textContent?.includes('Test complete.'), 'test ends on the result screen')
  const scoreText = (document.querySelector('.result .score')?.textContent ?? '').replace(/\s+/g, ' ')
  assert.equal(scoreText.trim(), '3 / 10', `score should be 3 / 10, got "${scoreText}"`)
  assert.ok((document.body.textContent ?? '').includes('Au') || document.querySelector('.review'))
  ok('test mode asks 10 random questions and scores them')

  // review lists the wrong answers
  assert.equal(q('.review-item').length, 7, 'review lists the seven missed questions')
  ok('result screen lists the missed questions')

  // ---------------------------------------------------------------- retry
  await click(find('.primary', 'Try again'))
  assert.ok(document.body.textContent?.includes('1 / 10'), 'retry starts a fresh test')
  assert.equal((document.querySelector('.counter')?.textContent ?? '').trim(), '1 / 10')
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
