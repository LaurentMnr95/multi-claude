import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS, PtySpawnOptions } from '../../shared/types'
import { ptyManager } from '../services/PtyManager'

export function registerPtyHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PTY_SPAWN, (_, options: PtySpawnOptions) => {
    return ptyManager.spawn(options)
  })

  ipcMain.handle(IPC_CHANNELS.PTY_WRITE, (_, { ptyId, data }: { ptyId: string; data: string }) => {
    ptyManager.write(ptyId, data)
  })

  ipcMain.handle(
    IPC_CHANNELS.PTY_RESIZE,
    (_, { ptyId, cols, rows }: { ptyId: string; cols: number; rows: number }) => {
      ptyManager.resize(ptyId, cols, rows)
    }
  )

  ipcMain.handle(IPC_CHANNELS.PTY_KILL, (_, ptyId: string) => {
    ptyManager.kill(ptyId)
  })
}

export function setPtyMainWindow(window: BrowserWindow): void {
  ptyManager.setMainWindow(window)
}
