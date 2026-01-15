import { ipcMain } from 'electron'
import { IPC_CHANNELS, AppSettings } from '../../shared/types'
import { StoreService } from '../services/StoreService'
import { IDEService } from '../services/IDEService'
import { TerminalService } from '../services/TerminalService'

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return StoreService.getSettings()
  })

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    (_, settings: Partial<AppSettings>) => {
      StoreService.setSettings(settings)
    }
  )

  ipcMain.handle(IPC_CHANNELS.IDE_OPEN_PATH, async (_, path: string) => {
    return IDEService.openPath(path)
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_OPEN_PATH, async (_, path: string) => {
    return TerminalService.openPath(path)
  })
}
