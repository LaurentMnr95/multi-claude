import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS, PtySpawnOptions } from '../../shared/types'
import { ptyManager } from '../services/PtyManager'
import * as fs from 'fs'
import * as path from 'path'

const logFile = path.join(process.cwd(), 'pty-debug.log')
function debugLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  fs.appendFileSync(logFile, line)
}

export function registerPtyHandlers(): void {
  debugLog('[IPC] Registering PTY handlers')

  ipcMain.handle(IPC_CHANNELS.PTY_SPAWN, (_, options: PtySpawnOptions) => {
    debugLog(`[IPC] PTY_SPAWN called with: ${JSON.stringify(options)}`)
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
