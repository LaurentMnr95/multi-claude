import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { IPC_CHANNELS, PtySpawnOptions } from '../../shared/types'

interface PtyInstance {
  id: string
  pty: pty.IPty
  worktreePath: string
  isClaudeSession: boolean
}

export class PtyManager {
  private instances = new Map<string, PtyInstance>()
  private mainWindow: BrowserWindow | null = null

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  spawn(options: PtySpawnOptions): string {
    const id = uuidv4()
    const shell = options.shell || this.getDefaultShell()

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: options.worktreePath,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      } as Record<string, string>,
    })

    const instance: PtyInstance = {
      id,
      pty: ptyProcess,
      worktreePath: options.worktreePath,
      isClaudeSession: false,
    }

    this.instances.set(id, instance)

    // Forward data to renderer
    ptyProcess.onData((data) => {
      this.mainWindow?.webContents.send(IPC_CHANNELS.PTY_DATA, id, data)
      // Detect Claude session from output
      this.detectClaudeSession(id, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      this.mainWindow?.webContents.send(IPC_CHANNELS.PTY_EXIT, id, exitCode)
      this.instances.delete(id)
    })

    return id
  }

  write(id: string, data: string): void {
    const instance = this.instances.get(id)
    if (instance) {
      instance.pty.write(data)
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const instance = this.instances.get(id)
    if (instance) {
      instance.pty.resize(cols, rows)
    }
  }

  kill(id: string): void {
    const instance = this.instances.get(id)
    if (instance) {
      instance.pty.kill()
      this.instances.delete(id)
    }
  }

  killAll(): void {
    for (const instance of this.instances.values()) {
      instance.pty.kill()
    }
    this.instances.clear()
  }

  private getDefaultShell(): string {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'powershell.exe'
    }
    return process.env.SHELL || '/bin/zsh'
  }

  private claudePatterns = [
    /Claude Code/i,
    /claude>/,
    /\[Claude\]/,
    /What would you like/i,
  ]

  private detectClaudeSession(id: string, data: string): void {
    const instance = this.instances.get(id)
    if (!instance) return

    const wasClaudeSession = instance.isClaudeSession

    // Check for Claude indicators
    for (const pattern of this.claudePatterns) {
      if (pattern.test(data)) {
        instance.isClaudeSession = true
        break
      }
    }

    // Notify renderer if status changed
    if (instance.isClaudeSession !== wasClaudeSession) {
      this.mainWindow?.webContents.send(
        IPC_CHANNELS.PTY_CLAUDE_STATUS,
        id,
        instance.isClaudeSession
      )
    }
  }
}

// Singleton instance
export const ptyManager = new PtyManager()
