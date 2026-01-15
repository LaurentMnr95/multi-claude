interface Props {
  hasTerminals: boolean
  onNewTerminal: () => void
  onNewClaude: () => void
  onSplitHorizontal: () => void
  onSplitVertical: () => void
  canSplit: boolean
  sidebarVisible: boolean
  onToggleSidebar: () => void
  onOpenInIDE: () => void
  ideName: string | null
  onOpenInTerminal: () => void
  terminalName: string | null
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
  onOpenInIDE,
  ideName,
  onOpenInTerminal,
  terminalName,
}: Props) {
  const ideLabel = ideName ? `Open in ${ideName}` : 'Open in IDE'
  const terminalLabel = terminalName ? `Open in ${terminalName}` : 'Open in Terminal'

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
        <button className="btn-text" onClick={onOpenInIDE} title={ideLabel}>
          ✎ {ideLabel}
        </button>
        <button className="btn-text" onClick={onOpenInTerminal} title={terminalLabel}>
          ⌘ {terminalLabel}
        </button>
      </div>
    </div>
  )
}
