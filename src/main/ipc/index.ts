import { registerGitHandlers } from './git.handlers'
import { registerPtyHandlers } from './pty.handlers'
import { registerDialogHandlers } from './dialog.handlers'
import { registerStoreHandlers } from './store.handlers'
import { registerSettingsHandlers } from './settings.handlers'

export function registerAllHandlers(): void {
  registerGitHandlers()
  registerPtyHandlers()
  registerDialogHandlers()
  registerStoreHandlers()
  registerSettingsHandlers()
}
