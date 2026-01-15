import { useState } from 'react'
import { Worktree, TerminalInstance } from '../../shared/types'

interface Props {
  worktree: Worktree
  isSelected: boolean
  terminals: TerminalInstance[]
  onSelect: () => void
  onDelete: () => Promise<void>
}

export function WorktreeItem({ worktree, isSelected, terminals, onSelect, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const claudeTerminals = terminals.filter(t => t.isClaudeSession)
  const claudeCount = claudeTerminals.length
  const termCount = terminals.filter(t => !t.isClaudeSession).length

  // Count Claude sessions by status
  const waitingCount = claudeTerminals.filter(t => t.claudeStatus === 'waiting').length
  const runningCount = claudeTerminals.filter(t => t.claudeStatus === 'running').length

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirmDelete) {
      setIsDeleting(true)
      onDelete().finally(() => {
        setIsDeleting(false)
        setConfirmDelete(false)
      })
    } else {
      setConfirmDelete(true)
      // Reset confirmation after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  return (
    <div
      className={`worktree-item ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="worktree-main">
        <span className="branch-icon">⎇</span>
        <span className="branch-name">{worktree.branch}</span>
        {worktree.isMain && <span className="badge badge-main">main</span>}
        {waitingCount > 0 && (
          <span className="status-dot waiting" title={`${waitingCount} Claude session(s) waiting for input`} />
        )}
        {waitingCount === 0 && runningCount > 0 && (
          <span className="status-dot running" title={`${runningCount} Claude session(s) running`} />
        )}
        {!worktree.isMain && (
          <button
            className={`worktree-delete ${confirmDelete ? 'confirm' : ''}`}
            onClick={handleDeleteClick}
            title={confirmDelete ? 'Click again to confirm' : 'Delete worktree'}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <span className="delete-spinner" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
              </svg>
            )}
          </button>
        )}
      </div>

      {(termCount > 0 || claudeCount > 0) && (
        <div className="worktree-stats">
          {termCount > 0 && <span className="stat-item">{termCount} term</span>}
          {claudeCount > 0 && (
            <span className="stat-item claude">{claudeCount} claude</span>
          )}
        </div>
      )}
    </div>
  )
}
