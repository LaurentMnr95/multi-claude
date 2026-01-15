import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { WorktreeItem } from './WorktreeItem'
import { CreateWorktreeModal } from './CreateWorktreeModal'

export function Sidebar() {
  const { repoPath, worktrees, selectedWorktreePath, selectWorktree, removeWorktree, openRepo, getTerminalsForWorktree, recentRepos, openRecentRepo, openSettings } = useApp()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const repoName = repoPath?.split('/').pop() || 'Repository'

  // Filter out current repo and limit to 5
  const otherRecentRepos = recentRepos
    .filter(r => r.repoPath !== repoPath)
    .slice(0, 5)

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 title={repoPath || ''}>{repoName}</h2>
        <div className="header-actions">
          <button className="btn-icon" onClick={openSettings} title="Settings">
            ⚙
          </button>
          <button className="btn-icon" onClick={openRepo} title="Open different repository">
            📁
          </button>
        </div>
      </div>

      {otherRecentRepos.length > 0 && (
        <div className="recent-section">
          <div className="section-header">
            <span>Recent</span>
          </div>
          <div className="recent-list-sidebar">
            {otherRecentRepos.map(repo => (
              <div
                key={repo.repoPath}
                className="recent-item-sidebar"
                onClick={() => openRecentRepo(repo.repoPath)}
                title={repo.repoPath}
              >
                <span className="repo-icon">📁</span>
                <span className="repo-name">{repo.repoName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
              onDelete={() => removeWorktree(worktree.path)}
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
