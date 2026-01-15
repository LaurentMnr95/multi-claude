import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { WorktreeItem } from './WorktreeItem'
import { CreateWorktreeModal } from './CreateWorktreeModal'

export function Sidebar() {
  const { repoPath, worktrees, selectedWorktreePath, selectWorktree, openRepo, getTerminalsForWorktree } = useApp()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const repoName = repoPath?.split('/').pop() || 'Repository'

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 title={repoPath || ''}>{repoName}</h2>
        <button className="btn-icon" onClick={openRepo} title="Open different repository">
          📁
        </button>
      </div>

      <div className="worktree-section">
        <div className="section-header">
          <span>Worktrees</span>
          <button className="btn-icon" onClick={() => setShowCreateModal(true)} title="Create worktree">
            +
          </button>
        </div>

        <div className="worktree-list">
          {worktrees.map(worktree => (
            <WorktreeItem
              key={worktree.path}
              worktree={worktree}
              isSelected={worktree.path === selectedWorktreePath}
              terminals={getTerminalsForWorktree(worktree.path)}
              onSelect={() => selectWorktree(worktree.path)}
            />
          ))}
        </div>
      </div>

      {showCreateModal && (
        <CreateWorktreeModal onClose={() => setShowCreateModal(false)} />
      )}
    </aside>
  )
}
