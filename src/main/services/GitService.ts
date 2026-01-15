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

  async createWorktree(branch: string, path: string, createBranch = false, startPoint?: string): Promise<void> {
    const args = ['worktree', 'add']
    if (createBranch) {
      // git worktree add -b <new-branch> <path> [<start-point>]
      args.push('-b', branch, path)
      if (startPoint) {
        args.push(startPoint)
      }
    } else {
      // git worktree add <path> <existing-branch>
      args.push(path, branch)
    }
    console.log('Git worktree command:', args.join(' '))
    await this.git.raw(args)
  }

  async removeWorktree(path: string, force = false): Promise<void> {
    const args = ['worktree', 'remove']
    if (force) args.push('--force')
    args.push(path)
    await this.git.raw(args)
  }

  async getBranches(): Promise<string[]> {
    const result = await this.git.branch(['-a'])
    // result.all includes both local and remote branches
    // Remote branches are prefixed with "remotes/origin/"
    // For worktree creation, we want local branches (preferred) and remote refs formatted as "origin/branch"
    const branches = result.all
      .map(b => b.replace(/^remotes\//, '').trim())
      .filter(b => b && !b.includes('HEAD'))

    // Deduplicate - prefer local over remote versions
    const seen = new Set<string>()
    const unique: string[] = []
    for (const branch of branches) {
      const localName = branch.replace(/^origin\//, '')
      if (!seen.has(localName)) {
        seen.add(localName)
        // If it's not a remote ref, add it; otherwise only add if local doesn't exist
        if (!branch.startsWith('origin/')) {
          unique.push(branch)
        } else if (!branches.includes(localName)) {
          unique.push(branch)
        }
      }
    }
    return unique
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
