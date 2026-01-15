import * as pty from 'node-pty'
import { BrowserWindow, Notification } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { IPC_CHANNELS, PtySpawnOptions, ClaudeStatus } from '../../shared/types'
import * as fs from 'fs'
import * as path from 'path'

// Debug log file
const logFile = path.join(process.cwd(), 'pty-debug.log')
function debugLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  fs.appendFileSync(logFile, line)
  console.log(msg)
}

interface PtyInstance {
  id: string
  pty: pty.IPty
  worktreePath: string
  isClaudeSession: boolean
  claudeStatus: ClaudeStatus
  lastNotificationTime: number
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
    debugLog(`[PTY] Spawning new PTY: ${id.slice(0, 8)}, shell: ${shell}, cwd: ${options.worktreePath}`)

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
      claudeStatus: null,
      lastNotificationTime: 0,
    }

    this.instances.set(id, instance)

    // Forward data to renderer
    ptyProcess.onData((data) => {
      // DEBUG: Log raw data length
      debugLog(`[PTY-RAW ${id.slice(0, 8)}] Received ${data.length} bytes`)
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

  // Patterns that indicate Claude Code is active
  private claudeDetectionPatterns = [
    /Claude Code/i,
    /claude>/,
    /\[Claude\]/,
    /Anthropic/i,
    /Claude \d+\.\d+/i,  // Version numbers like "Claude 3.5"
    /Enter to select.*navigate.*Esc/i,  // Claude's menu UI
    /claude-code/i,
  ]

  // Patterns that indicate Claude is waiting for user input
  private waitingPatterns = [
    // Claude Code interactive menus
    /Enter to select/i,
    /↑\/↓ to navigate/,
    /Esc to cancel/i,
    /to navigate.*Esc/i,
    // Permission prompts
    /\(Y\)es\s*\/\s*\(N\)o/i,
    /\[Y\/n\]/i,
    /\[y\/N\]/i,
    /Allow.*Deny/i,
    /yes\/no/i,
    /Do you want to/i,
    // Question prompts
    /What would you like/i,
    /How would you like/i,
    /Which.*would you.*\?/i,
    /Please (provide|enter|specify)/i,
    // Tool confirmation
    /Press.*to continue/i,
    /Confirm\?/i,
    // Claude prompt indicator
    /❯\s*$/,
    // Input waiting indicators
    /Type something/i,
    /Enter a message/i,
  ]

  // Patterns that indicate Claude is actively processing
  private runningPatterns = [
    /Thinking/i,
    /Processing/i,
    /Working on/i,
    /Analyzing/i,
    /Reading file/i,
    /Writing file/i,
    /Running command/i,
    /Searching/i,
    /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/, // Spinner characters
  ]

  private detectClaudeSession(id: string, data: string): void {
    const instance = this.instances.get(id)
    if (!instance) return

    const wasClaudeSession = instance.isClaudeSession
    const previousStatus = instance.claudeStatus

    // DEBUG: Log ALL terminal output to see patterns
    const cleanData = data.replace(/\x1b\[[0-9;]*m/g, '').replace(/[\r\n]+/g, ' ').trim()
    if (cleanData.length > 0) {
      debugLog(`[PTY ${id.slice(0, 8)}] Output: ${cleanData.slice(0, 200)}`)
    }

    // Check for Claude indicators
    for (const pattern of this.claudeDetectionPatterns) {
      if (pattern.test(data)) {
        instance.isClaudeSession = true
        debugLog(`[PTY ${id.slice(0, 8)}] Detected as Claude session via pattern: ${pattern}`)
        break
      }
    }

    // Only track status if it's a Claude session
    if (instance.isClaudeSession) {
      // Check if waiting for input (higher priority)
      let isWaiting = false
      let matchedWaitingPattern: RegExp | null = null
      for (const pattern of this.waitingPatterns) {
        if (pattern.test(cleanData)) {  // Test against clean data
          isWaiting = true
          matchedWaitingPattern = pattern
          break
        }
      }

      // Check if actively running
      let isRunning = false
      let matchedRunningPattern: RegExp | null = null
      for (const pattern of this.runningPatterns) {
        if (pattern.test(cleanData)) {  // Test against clean data
          isRunning = true
          matchedRunningPattern = pattern
          break
        }
      }

      if (isWaiting) {
        debugLog(`[PTY ${id.slice(0, 8)}] Matched WAITING pattern: ${matchedWaitingPattern}`)
      }
      if (isRunning) {
        debugLog(`[PTY ${id.slice(0, 8)}] Matched RUNNING pattern: ${matchedRunningPattern}`)
      }

      // Determine status - waiting takes precedence over running
      if (isWaiting) {
        instance.claudeStatus = 'waiting'
      } else if (isRunning) {
        instance.claudeStatus = 'running'
      }
      // If neither, keep previous status
    }

    // Notify renderer if anything changed
    const statusChanged = instance.claudeStatus !== previousStatus
    const claudeChanged = instance.isClaudeSession !== wasClaudeSession

    if (statusChanged || claudeChanged) {
      debugLog(`[PTY ${id.slice(0, 8)}] Status change: claude=${instance.isClaudeSession}, status=${previousStatus} -> ${instance.claudeStatus}`)
      this.mainWindow?.webContents.send(
        IPC_CHANNELS.PTY_CLAUDE_STATUS,
        id,
        instance.isClaudeSession,
        instance.claudeStatus
      )

      // Send system notification if transitioning to waiting and app not focused
      if (instance.claudeStatus === 'waiting' && previousStatus !== 'waiting') {
        this.sendWaitingNotification(instance)
      }
    }
  }

  private sendWaitingNotification(instance: PtyInstance): void {
    // Don't notify if app is focused
    if (this.mainWindow?.isFocused()) {
      return
    }

    // Debounce: Don't notify more than once every 5 seconds per terminal
    const now = Date.now()
    if (now - instance.lastNotificationTime < 5000) {
      return
    }
    instance.lastNotificationTime = now

    // Create and show system notification
    const notification = new Notification({
      title: 'Claude needs your input',
      body: 'Claude is waiting for your response',
      silent: false,
    })

    // Focus app when notification is clicked
    notification.on('click', () => {
      this.mainWindow?.show()
      this.mainWindow?.focus()
    })

    notification.show()
  }
}

// Singleton instance
export const ptyManager = new PtyManager()
