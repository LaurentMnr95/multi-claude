import { exec } from 'child_process'
import { IDE_OPTIONS } from '../../shared/types'
import { StoreService } from './StoreService'

export const IDEService = {
  async openPath(path: string): Promise<void> {
    const settings = StoreService.getSettings()

    if (!settings.defaultIDE) {
      throw new Error('NO_IDE_CONFIGURED')
    }

    let command: string

    if (settings.defaultIDE === 'custom') {
      if (!settings.customIDECommand) {
        throw new Error('NO_CUSTOM_IDE_COMMAND')
      }
      command = settings.customIDECommand
    } else {
      const ide = IDE_OPTIONS.find((i) => i.type === settings.defaultIDE)
      if (!ide) {
        throw new Error('UNKNOWN_IDE')
      }
      command = ide.command
    }

    return new Promise((resolve, reject) => {
      exec(`${command} "${path}"`, (error) => {
        if (error) {
          reject(new Error(`Failed to open IDE: ${error.message}`))
        } else {
          resolve()
        }
      })
    })
  },
}
