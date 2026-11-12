import type { ToastProps } from '@nuxt/ui'
import { TOAST_DURATION } from '~/constants/ui'

type Kind = keyof typeof TOAST_DURATION
type Action = { label: string; to?: string; onClick?: () => void }
type Options = { description?: string; icon?: string; action?: Action; id?: string }

const LOOK: Record<Kind, { color: ToastProps['color']; icon: string }> = {
  success: { color: 'success', icon: 'i-lucide-circle-check' },
  info: { color: 'neutral', icon: 'i-lucide-info' },
  warning: { color: 'warning', icon: 'i-lucide-triangle-alert' },
  error: { color: 'error', icon: 'i-lucide-circle-alert' },
  undoable: { color: 'neutral', icon: 'i-lucide-check' }
}

// The one way to show a toast: each kind always has its color, icon and duration, so a message is
// never green by accident, and every action looks the same (touch-sized neutral outline).
// The id defaults to the message, so a repeated message replaces the visible copy.
export const useAppToast = () => {
  const toast = useToast()
  const show = (kind: Kind, title: string, { description, icon, action, id }: Options = {}) => {
    id ??= `${kind}:${title}`
    if (toast.toasts.value.some((t) => t.id === id)) toast.remove(id)
    return toast.add({
      id,
      title,
      description,
      color: LOOK[kind].color,
      icon: icon ?? LOOK[kind].icon,
      duration: TOAST_DURATION[kind],
      actions: action && [{ ...action, color: 'neutral', variant: 'outline', size: 'md' }]
    })
  }
  return {
    success: (title: string, options?: Options) => show('success', title, options),
    info: (title: string, options?: Options) => show('info', title, options),
    warning: (title: string, options?: Options) => show('warning', title, options),
    error: (title: string, options?: Options) => show('error', title, options),
    undoable: (title: string, onUndo: () => void, options?: Omit<Options, 'action'>) =>
      show('undoable', title, { ...options, action: { label: 'Undo', onClick: onUndo } })
  }
}
