import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest'
import {loadQuizAnswers, saveQuizAnswers} from '../lib/guestQuiz'

const STORAGE_KEY = 'catmathmaker.quiz.v1'
const emptyAnswers = { household: [], temperaments: [] }

beforeEach(() => {
    sessionStorage.clear()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('guest quiz storage', () => {
    // checks saved text and checkbox selections can be read back unchanged
    it('restores text and checkbox answers', () => {
        const answers = {
            readiness: 'Next month',
            environment: 'Quiet',
            household: ['Cat(s)', 'Children'],
            temperaments: ['Lap cat'],
            age: 'Any age is a good age!',
        }

        expect(saveQuizAnswers(answers)).toBe(true)
        expect(loadQuizAnswers()).toEqual(answers)
    })
})

// Checks invalid JSON and unusable top level values are handled safely
it.each(['broken JSON', 'null', '42', '"hello"'])('handles invalid storage: %s', (value) => {
    sessionStorage.setItem(STORAGE_KEY, value)
    expect(loadQuizAnswers()).toEqual(emptyAnswers)
})

// Checks incorrect field types are ignored and invalid array items removed
it('cleans up invalid fields without losing valid selections', () => {
    sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            readiness: 42,
            environment: 'Quiet',
            household: ['Cat(s)', 42, null, 7, ''],
            temperaments: ['Lap cat', 8, '', null],
        })
    )

    expect(loadQuizAnswers()).toEqual({
        environment: 'Quiet',
        household: ['Cat(s)'],
        temperaments: ['Lap cat'],
    })
})

// Checks a blocked storage read returns defaults instead of throwing.
    it('handles blocked reads', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage blocked')
        })

        expect(loadQuizAnswers()).toEqual(emptyAnswers)
    })

    // Checks a blocked storage write reports failure instead of throwing.
    it('handles blocked writes', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage blocked')
        })

        expect(saveQuizAnswers({ readiness: 'Now' })).toBe(false)
    })
