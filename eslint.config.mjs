import prettier from 'eslint-config-prettier'
import withNuxt from './.nuxt/eslint.config.mjs'

// Prettier owns formatting; this turns off any ESLint rules that would fight it.
export default withNuxt().append(prettier)
