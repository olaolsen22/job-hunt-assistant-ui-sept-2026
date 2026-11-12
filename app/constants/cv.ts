// The CV layout choices shared by the tailored CV and CV template editors. "Template" here is the
// API's DETAILED/CONCISE style, not a CV template (the API's base CV).
export const TEMPLATE_OPTIONS = [
  { label: 'Detailed', value: 'DETAILED' },
  { label: 'Concise', value: 'CONCISE' }
]
export const TEMPLATE_HINTS = {
  DETAILED: 'Full bullets or paragraphs with the context behind each role.',
  CONCISE: 'Shorter bullets or paragraphs, aiming for a tighter, shorter CV.'
} as const

export const CONTENT_STYLE_OPTIONS = [
  { label: 'Bullets', value: 'BULLETS' },
  { label: 'Paragraphs', value: 'PARAGRAPH' }
]
export const CONTENT_STYLE_DESCRIPTION =
  'Experience, education, certifications and projects are all written as bullets or as paragraphs.'

export const SECTION_ORDER_OPTIONS = [
  { label: 'Standard', value: 'STANDARD' },
  { label: 'Developer', value: 'DEVELOPER' }
]
export const SECTION_ORDER_HINTS = {
  STANDARD: 'Standard order; skills on one line in the order shown; technologies not printed.',
  DEVELOPER:
    'Links under the contact lines, skills and projects moved up, skills grouped by category, technologies under entries.'
} as const
