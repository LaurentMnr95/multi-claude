import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'

interface Props {
  onClose: () => void
}

type BranchMode = 'existing' | 'new'

export function CreateWorktreeModal({ onClose }: Props) {
  const { repoPath, createWorktree } = useApp()
  const [branchMode, setBranchMode] = useState<BranchMode>('existing')
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [newBranchName, setNewBranchName] = useState('')
  const [baseBranch, setBaseBranch] = useState('')
  const [worktreePath, setWorktreePath] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadBranches() {
      if (!repoPath) return
      try {
        const branchList = await window.api.git.getBranches(repoPath)
        setBranches(branchList)
        if (branchList.length > 0) {
          setSelectedBranch(branchList[0])
          setBaseBranch(branchList[0])
        }
      } catch (err) {
        setError('Failed to load branches')
      }
    }
    loadBranches()
  }, [repoPath])

  // Update worktree path when branch selection changes
  useEffect(() => {
    if (!repoPath) return
    const repoDir = repoPath.substring(0, repoPath.lastIndexOf('/'))
    const repoName = repoPath.split('/').pop() || 'repo'

    if (branchMode === 'existing' && selectedBranch) {
      const branchName = selectedBranch.replace(/\//g, '-').replace(/^origin-/, '')
      setWorktreePath(`${repoDir}/${repoName}-${branchName}`)
    } else if (branchMode === 'new' && newBranchName) {
      const branchName = newBranchName.replace(/\//g, '-')
      setWorktreePath(`${repoDir}/${repoName}-${branchName}`)
    }
  }, [selectedBranch, newBranchName, branchMode, repoPath])

  async function handleCreate() {
    const branch = branchMode === 'existing' ? selectedBranch : newBranchName
    if (!branch || !worktreePath) return

    setIsLoading(true)
    setError(null)

    try {
      if (branchMode === 'new') {
        if (!baseBranch) {
          setError('Please select a base branch')
          setIsLoading(false)
          return
        }
        // When creating a new branch, pass the new branch name, path, createBranch flag, and base branch as start point
        await createWorktree(newBranchName, worktreePath, true, baseBranch)
      } else {
        await createWorktree(selectedBranch, worktreePath)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create worktree')
    } finally {
      setIsLoading(false)
    }
  }

  const isValid = branchMode === 'existing'
    ? selectedBranch && worktreePath
    : newBranchName && worktreePath && baseBranch

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create Worktree</h3>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>Branch Mode</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="branchMode"
                  value="existing"
                  checked={branchMode === 'existing'}
                  onChange={() => setBranchMode('existing')}
                  disabled={isLoading}
                />
                Use existing branch
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="branchMode"
                  value="new"
                  checked={branchMode === 'new'}
                  onChange={() => setBranchMode('new')}
                  disabled={isLoading}
                />
                Create new branch
              </label>
            </div>
          </div>

          {branchMode === 'existing' ? (
            <div className="form-group">
              <label>Branch</label>
              <select
                autoFocus
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                disabled={isLoading}
              >
                {branches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>New Branch Name</label>
                <input
                  type="text"
                  autoFocus
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  placeholder="feature/my-new-feature"
                  disabled={isLoading}
                />
              </div>
              <div className="form-group">
                <label>Base Branch</label>
                <select
                  value={baseBranch}
                  onChange={e => setBaseBranch(e.target.value)}
                  disabled={isLoading}
                >
                  {branches.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
                <small className="form-hint">The new branch will be created from this branch</small>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Worktree Path</label>
            <input
              type="text"
              value={worktreePath}
              onChange={e => setWorktreePath(e.target.value)}
              placeholder="/path/to/worktree"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={isLoading || !isValid}
          >
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
