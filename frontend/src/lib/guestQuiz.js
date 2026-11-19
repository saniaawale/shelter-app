const STORAGE_KEY = 'catmathmaker.quiz.v1'

const textFields = [
    'readiness',
    'environment',
    'experience',
    'age',
    'care',
    'count'
]

export function loadQuizAnswers() {
    const answers = { household: [], temperaments: [] }

    try {
        const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY))

        if (!stored || typeof stored !== 'object') return answers

        for (const field of textFields) {
            if (typeof stored[field] === 'string') {
                answers[field] = stored[field]
            }
        }

        // restore checkboxes as arrays of strings
        for (const field of ['household', 'temperaments']) {
            if (Array.isArray(stored[field])) {
                answers[field] = stored[field].filter(item => typeof item === 'string' && item.trim() !== '')
            }
        }
    } catch  {
        //Use empty answers if storage is blocked or contains invalid JSON
    }
    return answers
}

export function saveQuizAnswers(answers) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
        return true
    } catch {
        return false
        // the quiz remains usable - even if the browser is blocking storage, the user can still fill out the quiz and review their answers. The answers just won't persist across page reloads.
    }
}
