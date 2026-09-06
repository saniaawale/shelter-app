const API_BASE = (import.meta.env.VITE_APP_BASE_URL || '/api').replace(/\/$/,'')

export function hasQuizAnswers(answers) {
    return['readiness', 'environment', 'experience', 'age', 'care', 'count'].every(field => typeof answers[field] === 'string' && answers[field].trim())
    && Array.isArray(answers.household)
    && Array.isArray(answers.temperaments) && answers.temperaments.length > 0
}

export async function fetchMatches(answers, signal) {
    const response = await fetch(`${API_BASE}/matches` , {
        method : 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(answers), signal,
    })

    if (!response.ok){
        throw new Error(response.status === 422
            ? 'Please retake the quiz and check your answers': 'Could not load cat matches. Please try again.'
        )
    }
    const data = await response.json()
    const validResult = result => result && typeof result.source_record_id === 'string' && typeof result.name === 'string' && Number.isFinite(result.score)
    && Array.isArray(result.reasons) && Number.isFinite(result.score)
    && Array.isArray(result.considerations) && result.considerations.every(item => typeof item === 'string') 
    if (!data || !Array.isArray(data.matches) || !Array.isArray(data.needs_confirmation) || !data.matches.every(validResult) || !data.needs_confirmation.every(validResult)) {
    throw new Error('Could not load cat matches. Please try again.')
}
return data
}