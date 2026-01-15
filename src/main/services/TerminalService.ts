import { exec } from 'child_process'
import { TERMINAL_OPTIONS } from '../../shared/types'
import { StoreService } from './StoreService'

function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function getAppleScript(terminalType: string, path: string): string | null {
  const escapedPath = escapeAppleScript(path)

  switch (terminalType) {
    case 'iterm':
      return `
        tell application "iTerm2"
          activate
          if (count of windows) = 0 then
            create window with default profile
            tell current session of current window
              write text "cd \\"${escapedPath}\\""
            end tell
          else
            tell current window
              create tab with default profile
              tell current session
                write text "cd \\"${escapedPath}\\""
              end tell
            end tell
          end if
        end tell
      `
    case 'terminal':
      return `
        tell application "Terminal"
          activate
          do script "cd \\"${escapedPath}\\""
        end tell
      `
    case 'warp':
      return `
        tell application "Warp"
          activate
          if (count of windows) = 0 then
            tell application "System Events"
              keystroke "t" using command down
            end tell
            delay 0.3
          end if
        end tell
        tell application "System Events"
          tell process "Warp"
            keystroke "cd \\"${escapedPath}\\"" & return
          end tell
        end tell
      `
    default:
      return null
  }
}

export const TerminalService = {
  async openPath(path: string): Promise<void> {
    const settings = StoreService.getSettings()

    if (!settings.defaultTerminal) {
      throw new Error('NO_TERMINAL_CONFIGURED')
    }

    const terminalType = settings.defaultTerminal

    if (terminalType === 'custom') {
      if (!settings.customTerminalCommand) {
        throw new Error('NO_CUSTOM_TERMINAL_COMMAND')
      }
      return new Promise((resolve, reject) => {
        exec(`${settings.customTerminalCommand} "${path}"`, (error) => {
          if (error) {
            reject(new Error(`Failed to open terminal: ${error.message}`))
          } else {
            resolve()
          }
        })
      })
    }

    // Handle Alacritty specially - it uses command line args
    if (terminalType === 'alacritty') {
      return new Promise((resolve, reject) => {
        exec(`alacritty --working-directory "${path}"`, (error) => {
          if (error) {
            reject(new Error(`Failed to open Alacritty: ${error.message}`))
          } else {
            resolve()
          }
        })
      })
    }

    // Use AppleScript for iTerm, Terminal, Warp
    const appleScript = getAppleScript(terminalType, path)
    if (!appleScript) {
      const terminal = TERMINAL_OPTIONS.find((t) => t.type === terminalType)
      throw new Error(`UNKNOWN_TERMINAL: ${terminal?.name || terminalType}`)
    }

    return new Promise((resolve, reject) => {
      exec(`osascript -e '${appleScript.replace(/'/g, "'\"'\"'")}'`, (error) => {
        if (error) {
          reject(new Error(`Failed to open terminal: ${error.message}`))
        } else {
          resolve()
        }
      })
    })
  },
}
