import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { GitService } from '../services/GitService'

const gitServices = new Map<string, GitService>()

function getOrCreateService(repoPath: string): GitService {
  if (!gitServices.has(repoPath)) {
    gitServices.set(repoPath, new GitService(repoPath))
  }
  return gitServices.get(repoPath)!
}

export function registerGitHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GIT_LIST_WORKTREES, async (_, repoPath: string) => {
    const service = getOrCreateService(repoPath)
    return service.listWorktrees()
  })

  ipcMain.handle(
    IPC_CHANNELS.GIT_CREATE_WORKTREE,
    async (_, args: { repoPath: string; branch: string; path: string; createBranch?: boolean; startPoint?: string }) => {
      console.log('createWorktree IPC received:', JSON.stringify(args))
      const { repoPath, branch, path, createBranch, startPoint } = args
      console.log('Destructured - createBranch:', createBranch, 'startPoint:', startPoint)
      const service = getOrCreateService(repoPath)
      await service.createWorktree(branch, path, createBranch === true, startPoint)
      return service.listWorktrees()
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GIT_REMOVE_WORKTREE,
    async (_, { repoPath, worktreePath }: { repoPath: string; worktreePath: string }) => {
      const service = getOrCreateService(repoPath)
      await service.removeWorktree(worktreePath)
      return service.listWorktrees()
    }
  )

  ipcMain.handle(IPC_CHANNELS.GIT_GET_BRANCHES, async (_, repoPath: string) => {
    const service = getOrCreateService(repoPath)
    return service.getBranches()
  })
}
