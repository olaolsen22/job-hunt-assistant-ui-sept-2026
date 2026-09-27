// Local YYYY-MM-DD. toISOString() is UTC, so near midnight it would give yesterday or tomorrow.
export const todayIso = () => new Date().toLocaleDateString('sv-SE')
