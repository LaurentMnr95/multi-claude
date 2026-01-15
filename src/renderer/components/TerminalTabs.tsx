interface Props {
  hasTerminals: boolean
  onNewTerminal: () => void
  onNewClaude: () => void
  onSplitHorizontal: () => void
  onSplitVertical: () => void
  canSplit: boolean
  sidebarVisible: boolean
  onToggleSidebar: () => void
}

export function TerminalTabs({
  hasTerminals,
  onNewTerminal,
  onNewClaude,
  onSplitHorizontal,
  onSplitVertical,
  canSplit,
  sidebarVisible,
  onToggleSidebar,
}: Props) {
  return (
    <div className="terminal-tabs">
      <button
        className="btn-icon sidebar-toggle"
        onClick={onToggleSidebar}
        title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
      >
        {sidebarVisible ? '◀' : '▶'}
      </button>

      <div className="tabs-spacer" />

      <div className="tabs-actions">
        <button className="btn-icon" onClick={onNewTerminal} title="New Terminal">
          +
        </button>
        <button className="btn-icon claude" onClick={onNewClaude} title="New Claude">
          ✨
        </button>
        {hasTerminals && (
          <div className="split-buttons">
            <button
              className="btn-icon"
              onClick={onSplitHorizontal}
              title="Split Right"
              disabled={!canSplit}
            >
              ⊞
            </button>
            <button
              className="btn-icon"
              onClick={onSplitVertical}
              title="Split Down"
              disabled={!canSplit}
            >
              ⊟
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
