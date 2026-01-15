import { Worktree, TerminalInstance } from '../../shared/types'

interface Props {
  worktree: Worktree
  isSelected: boolean
  terminals: TerminalInstance[]
  onSelect: () => void
}

export function WorktreeItem({ worktree, isSelected, terminals, onSelect }: Props) {
  const claudeCount = terminals.filter(t => t.isClaudeSession).length
  const termCount = terminals.filter(t => !t.isClaudeSession).length

  return (
    <div
      className={`worktree-item ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="worktree-main">
        <span className="branch-icon">⎇</span>
        <span className="branch-name">{worktree.branch}</span>
        {worktree.isMain && <span className="badge badge-main">main</span>}
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
