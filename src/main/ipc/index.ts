import { registerGitHandlers } from './git.handlers'
import { registerPtyHandlers } from './pty.handlers'
import { registerDialogHandlers } from './dialog.handlers'

export function registerAllHandlers(): void {
  registerGitHandlers()
  registerPtyHandlers()
  registerDialogHandlers()
}
