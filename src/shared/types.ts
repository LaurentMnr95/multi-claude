// IPC Channel Constants
export const IPC_CHANNELS = {
  // Git operations
  GIT_OPEN_REPO: 'git:openRepo',
  GIT_LIST_WORKTREES: 'git:listWorktrees',
  GIT_CREATE_WORKTREE: 'git:createWorktree',
  GIT_REMOVE_WORKTREE: 'git:removeWorktree',
  GIT_GET_BRANCHES: 'git:getBranches',

  // PTY operations
  PTY_SPAWN: 'pty:spawn',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',
  PTY_CLAUDE_STATUS: 'pty:claudeStatus',

  // Dialog
  DIALOG_OPEN_FOLDER: 'dialog:openFolder',
} as const

// Worktree Types
export interface Worktree {
  path: string
  branch: string
  head: string
  isMain: boolean
  isLocked: boolean
}

// Terminal Types
export interface TerminalInstance {
  id: string
  worktreePath: string
  title: string
  isClaudeSession: boolean
}

// Split Pane Types
export type SplitDirection = 'horizontal' | 'vertical'

export interface SplitNode {
  type: 'split'
  direction: SplitDirection
  ratio: number // 0-1, proportion of first child
  first: SplitLayoutNode
  second: SplitLayoutNode
}

export interface TerminalNode {
  type: 'terminal'
  terminalId: string
}

export type SplitLayoutNode = SplitNode | TerminalNode | null

export interface WorktreeSplitLayout {
  [worktreePath: string]: SplitLayoutNode
}

export interface PtySpawnOptions {
  worktreePath: string
  cols?: number
  rows?: number
  shell?: string
}

// API Types exposed to renderer
export interface GitAPI {
  openRepo: () => Promise<string | null>
  listWorktrees: (repoPath: string) => Promise<Worktree[]>
  createWorktree: (repoPath: string, branch: string, path: string) => Promise<Worktree[]>
  removeWorktree: (repoPath: string, worktreePath: string) => Promise<Worktree[]>
  getBranches: (repoPath: string) => Promise<string[]>
}

export interface PtyAPI {
  spawn: (options: PtySpawnOptions) => Promise<string>
  write: (ptyId: string, data: string) => Promise<void>
  resize: (ptyId: string, cols: number, rows: number) => Promise<void>
  kill: (ptyId: string) => Promise<void>
  onData: (callback: (ptyId: string, data: string) => void) => () => void
  onExit: (callback: (ptyId: string, exitCode: number) => void) => () => void
  onClaudeStatus?: (callback: (ptyId: string, isClaude: boolean) => void) => () => void
}

export interface ElectronAPI {
  git: GitAPI
  pty: PtyAPI
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
