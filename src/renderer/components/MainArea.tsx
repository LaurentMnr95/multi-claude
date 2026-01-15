import { useCallback, useState } from 'react'
import { useApp } from '../context/AppContext'
import { TerminalTabs } from './TerminalTabs'
import { SplitPane } from './SplitPane'

interface MainAreaProps {
  sidebarVisible: boolean
  onToggleSidebar: () => void
}

export function MainArea({ sidebarVisible, onToggleSidebar }: MainAreaProps) {
  const {
    selectedWorktreePath,
    activeTerminalId,
    addTerminal,
    removeTerminal,
    setActiveTerminal,
    getTerminalsForWorktree,
    getSplitLayout,
    splitTerminal,
    updateSplitRatio,
    moveTerminal,
  } = useApp()

  const [draggedTerminalId, setDraggedTerminalId] = useState<string | null>(null)

  const terminals = selectedWorktreePath
    ? getTerminalsForWorktree(selectedWorktreePath)
    : []

  const handleNewTerminal = useCallback(async () => {
    if (!selectedWorktreePath) return

    const ptyId = await window.api.pty.spawn({ worktreePath: selectedWorktreePath })
    const termNumber = terminals.filter(t => !t.isClaudeSession).length + 1

    addTerminal({
      id: ptyId,
      worktreePath: selectedWorktreePath,
      title: `Terminal ${termNumber}`,
      isClaudeSession: false,
    }, activeTerminalId)
  }, [selectedWorktreePath, terminals, addTerminal, activeTerminalId])

  const handleNewClaude = useCallback(async () => {
    if (!selectedWorktreePath) return

    const ptyId = await window.api.pty.spawn({ worktreePath: selectedWorktreePath })

    // Start claude CLI
    setTimeout(() => {
      window.api.pty.write(ptyId, 'claude\n')
    }, 100)

    const claudeNumber = terminals.filter(t => t.isClaudeSession).length + 1

    addTerminal({
      id: ptyId,
      worktreePath: selectedWorktreePath,
      title: `Claude ${claudeNumber}`,
      isClaudeSession: true,
    }, activeTerminalId)
  }, [selectedWorktreePath, terminals, addTerminal, activeTerminalId])

  const handleCloseTerminal = useCallback(async (id: string) => {
    await window.api.pty.kill(id)
    removeTerminal(id)
  }, [removeTerminal])

  const handleSplitHorizontal = useCallback(() => {
    if (activeTerminalId) {
      splitTerminal(activeTerminalId, 'horizontal')
    }
  }, [activeTerminalId, splitTerminal])

  const handleSplitVertical = useCallback(() => {
    if (activeTerminalId) {
      splitTerminal(activeTerminalId, 'vertical')
    }
  }, [activeTerminalId, splitTerminal])

  const handleUpdateRatio = useCallback((path: number[], ratio: number) => {
    if (selectedWorktreePath) {
      updateSplitRatio(selectedWorktreePath, path, ratio)
    }
  }, [selectedWorktreePath, updateSplitRatio])

  const handleMoveTerminal = useCallback((sourceId: string, targetId: string, position: 'left' | 'right' | 'top' | 'bottom') => {
    if (selectedWorktreePath) {
      moveTerminal(selectedWorktreePath, sourceId, targetId, position)
    }
  }, [selectedWorktreePath, moveTerminal])

  const handleDragStart = useCallback((terminalId: string) => {
    setDraggedTerminalId(terminalId)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedTerminalId(null)
  }, [])

  const splitLayout = selectedWorktreePath ? getSplitLayout(selectedWorktreePath) : null

  if (!selectedWorktreePath) {
    return (
      <main className="main-area empty">
        <p>Select a worktree to begin</p>
      </main>
    )
  }

  return (
    <main className="main-area">
      <TerminalTabs
        hasTerminals={terminals.length > 0}
        onNewTerminal={handleNewTerminal}
        onNewClaude={handleNewClaude}
        onSplitHorizontal={handleSplitHorizontal}
        onSplitVertical={handleSplitVertical}
        canSplit={!!activeTerminalId}
        sidebarVisible={sidebarVisible}
        onToggleSidebar={onToggleSidebar}
      />

      <div className="terminal-container">
        {terminals.length === 0 ? (
          <div className="no-terminals">
            <p>No terminals open</p>
            <div className="quick-actions">
              <button className="btn-secondary" onClick={handleNewTerminal}>
                New Terminal
              </button>
              <button className="btn-primary" onClick={handleNewClaude}>
                New Claude
              </button>
            </div>
          </div>
        ) : (
          <SplitPane
            layout={splitLayout}
            activeTerminalId={activeTerminalId}
            terminals={terminals}
            onUpdateRatio={handleUpdateRatio}
            onSelectTerminal={setActiveTerminal}
            onCloseTerminal={handleCloseTerminal}
            onMoveTerminal={handleMoveTerminal}
            draggedTerminalId={draggedTerminalId}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        )}
      </div>
    </main>
  )
}
