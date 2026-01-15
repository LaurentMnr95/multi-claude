// Claude Status Type
export type ClaudeStatus = 'running' | 'waiting' | null

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

  // Store operations
  STORE_GET_RECENT_REPOS: 'store:getRecentRepos',
  STORE_GET_REPO_SESSION: 'store:getRepoSession',
  STORE_SAVE_SESSION: 'store:saveSession',
  STORE_REMOVE_REPO: 'store:removeRepo',

  // Settings operations
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // IDE operations
  IDE_OPEN_PATH: 'ide:openPath',

  // Terminal App operations
  TERMINAL_OPEN_PATH: 'terminal:openPath',
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
  claudeStatus: ClaudeStatus
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

// Store Types - for persistence
export interface SavedTerminal {
  worktreePath: string
  title: string
  isClaudeSession: boolean
  claudeStatus?: ClaudeStatus
}

export interface RepoSessionState {
  repoPath: string
  repoName: string
  selectedWorktreePath: string | null
  splitLayouts: WorktreeSplitLayout
  terminals: SavedTerminal[]
  lastOpened: number
}

// IDE Types
export type IDEType = 'vscode' | 'cursor' | 'webstorm' | 'sublime' | 'custom'

export interface IDEConfig {
  type: IDEType
  name: string
  command: string
}

export const IDE_OPTIONS: IDEConfig[] = [
  { type: 'vscode', name: 'Visual Studio Code', command: 'code' },
  { type: 'cursor', name: 'Cursor', command: 'cursor' },
  { type: 'webstorm', name: 'WebStorm', command: 'webstorm' },
  { type: 'sublime', name: 'Sublime Text', command: 'subl' },
]

// Terminal App Types
export type TerminalAppType = 'iterm' | 'terminal' | 'warp' | 'alacritty' | 'custom'

export interface TerminalConfig {
  type: TerminalAppType
  name: string
}

export const TERMINAL_OPTIONS: TerminalConfig[] = [
  { type: 'iterm', name: 'iTerm' },
  { type: 'terminal', name: 'Terminal' },
  { type: 'warp', name: 'Warp' },
  { type: 'alacritty', name: 'Alacritty' },
]

// Settings Types
export interface AppSettings {
  defaultIDE: IDEType | null
  customIDECommand: string | null
  defaultTerminal: TerminalAppType | null
  customTerminalCommand: string | null
}

export interface StoreSchema {
  recentRepos: RepoSessionState[]
  maxRecentRepos: number
  settings: AppSettings
}

// API Types exposed to renderer
export interface GitAPI {
  openRepo: () => Promise<string | null>
  listWorktrees: (repoPath: string) => Promise<Worktree[]>
  createWorktree: (repoPath: string, branch: string, path: string, createBranch?: boolean, startPoint?: string) => Promise<Worktree[]>
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
  onClaudeStatus?: (callback: (ptyId: string, isClaude: boolean, status: ClaudeStatus) => void) => () => void
}

export interface StoreAPI {
  getRecentRepos: () => Promise<RepoSessionState[]>
  getRepoSession: (repoPath: string) => Promise<RepoSessionState | null>
  saveSession: (session: RepoSessionState) => Promise<void>
  removeRepo: (repoPath: string) => Promise<void>
}

export interface SettingsAPI {
  get: () => Promise<AppSettings>
  set: (settings: Partial<AppSettings>) => Promise<void>
}

export interface IDEAPI {
  openPath: (path: string) => Promise<void>
}

export interface TerminalAppAPI {
  openPath: (path: string) => Promise<void>
}

export interface ElectronAPI {
  git: GitAPI
  pty: PtyAPI
  store: StoreAPI
  settings: SettingsAPI
  ide: IDEAPI
  terminalApp: TerminalAppAPI
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
