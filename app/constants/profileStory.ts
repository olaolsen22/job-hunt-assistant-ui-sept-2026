// The profile story's five parts, in the order cover letter prompts read them. Only cover letters
// use the story; it never prints on a CV.
export const STORY_FIELDS = [
  {
    key: 'origin',
    label: 'Where you’re from',
    hint: 'Where you grew up or call home, and what that place gave you.'
  },
  {
    key: 'upbringing',
    label: 'Upbringing',
    hint: 'Family, school or early experiences that shaped you.'
  },
  {
    key: 'careerJourney',
    label: 'Career journey',
    hint: 'How you got into the field and the turns along the way.'
  },
  {
    key: 'motivation',
    label: 'Motivation',
    hint: 'What drives you and what you want next.'
  },
  {
    key: 'values',
    label: 'How you work',
    hint: 'What you care about in a team and in your work.'
  }
] as const

export const STORY_MAX_LENGTH = 2000
