import simpleGit, { SimpleGit } from 'simple-git'
import { Worktree } from '../../shared/types'

export class GitService {
  private git: SimpleGit

  constructor(repoPath: string) {
    this.git = simpleGit(repoPath)
  }

  async listWorktrees(): Promise<Worktree[]> {
    const result = await this.git.raw(['worktree', 'list', '--porcelain'])
    return this.parseWorktreeOutput(result)
  }

  async createWorktree(branch: string, path: string, createBranch = false): Promise<void> {
    const args = ['worktree', 'add']
    if (createBranch) args.push('-b')
    args.push(path, branch)
    await this.git.raw(args)
  }

  async removeWorktree(path: string, force = false): Promise<void> {
    const args = ['worktree', 'remove']
    if (force) args.push('--force')
    args.push(path)
    await this.git.raw(args)
  }

  async getBranches(): Promise<string[]> {
    const result = await this.git.branch()
    return [...result.all]
  }

  private parseWorktreeOutput(output: string): Worktree[] {
    const worktrees: Worktree[] = []
    const blocks = output.trim().split('\n\n')

    for (const block of blocks) {
      if (!block.trim()) continue

      const lines = block.split('\n')
      const worktree: Partial<Worktree> = {
        isLocked: false,
        isMain: false,
      }

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          worktree.path = line.substring(9)
        } else if (line.startsWith('HEAD ')) {
          worktree.head = line.substring(5)
        } else if (line.startsWith('branch ')) {
          worktree.branch = line.substring(7).replace('refs/heads/', '')
        } else if (line === 'locked') {
          worktree.isLocked = true
        } else if (line === 'bare') {
          // Skip bare repos
          continue
        }
      }

      if (worktree.path) {
        worktrees.push({
          path: worktree.path,
          branch: worktree.branch || 'detached',
          head: worktree.head || '',
          isMain: worktrees.length === 0,
          isLocked: worktree.isLocked || false,
        })
      }
    }

    return worktrees
  }
}
