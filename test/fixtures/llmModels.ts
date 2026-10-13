// Two models, so the pickers render; `defaultModel` is what the server reports for the user.
export const llmModels = (defaultModel = 'fast') => ({
  models: [
    { id: 'fast', label: 'Fast', provider: 'gemini', keySource: 'SHARED' },
    { id: 'strong', label: 'Strong', provider: 'gemini', keySource: 'SHARED' }
  ],
  defaultModel
})

// The owner's own OpenAI key added a model.
export const ownKeyModel = {
  id: 'openai:gpt-4.1-mini',
  label: 'GPT-4.1 mini',
  provider: 'openai',
  keySource: 'USER'
}

export const unknownModelError = {
  __typename: 'UnknownLlmModelError',
  message: 'That model isn’t available.'
}
