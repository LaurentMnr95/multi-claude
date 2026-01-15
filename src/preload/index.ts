import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  ElectronAPI,
  PtySpawnOptions,
  RepoSessionState,
  AppSettings,
  ClaudeStatus,
} from '../shared/types'

const api: ElectronAPI = {
  git: {
    openRepo: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FOLDER),

    listWorktrees: (repoPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_LIST_WORKTREES, repoPath),

    createWorktree: (repoPath: string, branch: string, path: string, createBranch?: boolean, startPoint?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_CREATE_WORKTREE, { repoPath, branch, path, createBranch, startPoint }),

    removeWorktree: (repoPath: string, worktreePath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_REMOVE_WORKTREE, { repoPath, worktreePath }),

    getBranches: (repoPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_BRANCHES, repoPath),
  },

  pty: {
    spawn: (options: PtySpawnOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.PTY_SPAWN, options),

    write: (ptyId: string, data: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PTY_WRITE, { ptyId, data }),

    resize: (ptyId: string, cols: number, rows: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.PTY_RESIZE, { ptyId, cols, rows }),

    kill: (ptyId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PTY_KILL, ptyId),

    onData: (callback: (ptyId: string, data: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, ptyId: string, data: string) =>
        callback(ptyId, data)
      ipcRenderer.on(IPC_CHANNELS.PTY_DATA, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.PTY_DATA, handler)
    },

    onExit: (callback: (ptyId: string, exitCode: number) => void) => {
      const handler = (_: Electron.IpcRendererEvent, ptyId: string, exitCode: number) =>
        callback(ptyId, exitCode)
      ipcRenderer.on(IPC_CHANNELS.PTY_EXIT, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.PTY_EXIT, handler)
    },

    onClaudeStatus: (callback: (ptyId: string, isClaude: boolean, status: ClaudeStatus) => void) => {
      const handler = (_: Electron.IpcRendererEvent, ptyId: string, isClaude: boolean, status: ClaudeStatus) =>
        callback(ptyId, isClaude, status)
      ipcRenderer.on(IPC_CHANNELS.PTY_CLAUDE_STATUS, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.PTY_CLAUDE_STATUS, handler)
    },
  },

  store: {
    getRecentRepos: () => ipcRenderer.invoke(IPC_CHANNELS.STORE_GET_RECENT_REPOS),

    getRepoSession: (repoPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.STORE_GET_REPO_SESSION, repoPath),

    saveSession: (session: RepoSessionState) =>
      ipcRenderer.invoke(IPC_CHANNELS.STORE_SAVE_SESSION, session),

    removeRepo: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.STORE_REMOVE_REPO, repoPath),
  },

  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),

    set: (settings: Partial<AppSettings>) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),
  },

  ide: {
    openPath: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.IDE_OPEN_PATH, path),
  },

  terminalApp: {
    openPath: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_OPEN_PATH, path),
  },
}

contextBridge.exposeInMainWorld('api', api)
