import { ipcMain } from 'electron'
import { IPC_CHANNELS, RepoSessionState } from '../../shared/types'
import { StoreService } from '../services/StoreService'

export function registerStoreHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.STORE_GET_RECENT_REPOS, () => {
    return StoreService.getRecentRepos()
  })

  ipcMain.handle(IPC_CHANNELS.STORE_GET_REPO_SESSION, (_, repoPath: string) => {
    return StoreService.getRepoSession(repoPath)
  })

  ipcMain.handle(IPC_CHANNELS.STORE_SAVE_SESSION, (_, session: RepoSessionState) => {
    StoreService.saveSession(session)
  })

  ipcMain.handle(IPC_CHANNELS.STORE_REMOVE_REPO, (_, repoPath: string) => {
    StoreService.removeRepo(repoPath)
  })
}
