import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'

interface Props {
  onClose: () => void
}

export function CreateWorktreeModal({ onClose }: Props) {
  const { repoPath, createWorktree } = useApp()
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
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
        }
      } catch (err) {
        setError('Failed to load branches')
      }
    }
    loadBranches()
  }, [repoPath])

  useEffect(() => {
    if (selectedBranch && repoPath) {
      const repoDir = repoPath.substring(0, repoPath.lastIndexOf('/'))
      const repoName = repoPath.split('/').pop() || 'repo'
      const branchName = selectedBranch.replace(/\//g, '-').replace(/^origin-/, '')
      setWorktreePath(`${repoDir}/${repoName}-${branchName}`)
    }
  }, [selectedBranch, repoPath])

  async function handleCreate() {
    if (!selectedBranch || !worktreePath) return

    setIsLoading(true)
    setError(null)

    try {
      await createWorktree(selectedBranch, worktreePath)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create worktree')
    } finally {
      setIsLoading(false)
    }
  }

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
            <label>Branch</label>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              disabled={isLoading}
            >
              {branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

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
            disabled={isLoading || !selectedBranch || !worktreePath}
          >
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
