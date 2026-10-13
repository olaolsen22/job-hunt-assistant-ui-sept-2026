const LABELS: Record<string, string> = {
  gemini: 'Gemini',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  mistral: 'Mistral'
}

// The API names providers by id; one it adds later still shows, just unformatted.
export const providerLabel = (provider: string) => LABELS[provider] ?? provider
