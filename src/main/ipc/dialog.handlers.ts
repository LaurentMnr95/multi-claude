import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { GitService } from '../services/GitService'

export function registerDialogHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Git Repository',
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const repoPath = result.filePaths[0]

    // Validate it's a git repo by trying to list worktrees
    try {
      const service = new GitService(repoPath)
      await service.listWorktrees()
      return repoPath
    } catch {
      throw new Error('Selected folder is not a valid Git repository')
    }
  })
}
