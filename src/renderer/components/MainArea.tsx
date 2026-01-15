import { useCallback, useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { TerminalTabs } from './TerminalTabs'
import { SplitPane } from './SplitPane'
import { IDE_OPTIONS, TERMINAL_OPTIONS } from '../../shared/types'

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
    splitTerminal,
    updateSplitRatio,
    moveTerminal,
    openInIDE,
    openInTerminal,
    settings,
    showSettingsModal,
    getNextTerminalNumber,
    getNextClaudeNumber,
  } = useApp()

  const ideName = useMemo(() => {
    if (!settings?.defaultIDE) return null
    if (settings.defaultIDE === 'custom') return 'IDE'
    const ide = IDE_OPTIONS.find(i => i.type === settings.defaultIDE)
    return ide?.name || null
  }, [settings])

  const terminalName = useMemo(() => {
    if (!settings?.defaultTerminal) return null
    if (settings.defaultTerminal === 'custom') return 'Terminal'
    const term = TERMINAL_OPTIONS.find(t => t.type === settings.defaultTerminal)
    return term?.name || null
  }, [settings])

  const [draggedTerminalId, setDraggedTerminalId] = useState<string | null>(null)

  const terminalsForCurrentWorktree = selectedWorktreePath
    ? getTerminalsForWorktree(selectedWorktreePath)
    : []

  // Get all worktrees that have terminals (to keep them mounted)
  const { terminals: allTerminals, splitLayouts } = useApp()
  const worktreesWithTerminals = [...new Set(allTerminals.map(t => t.worktreePath))]

  const handleNewTerminal = useCallback(async () => {
    if (!selectedWorktreePath) return

    const ptyId = await window.api.pty.spawn({ worktreePath: selectedWorktreePath })
    const termNumber = getNextTerminalNumber(selectedWorktreePath)

    addTerminal({
      id: ptyId,
      worktreePath: selectedWorktreePath,
      title: `Terminal ${termNumber}`,
      isClaudeSession: false,
    }, activeTerminalId)
  }, [selectedWorktreePath, addTerminal, activeTerminalId, getNextTerminalNumber])

  const handleNewClaude = useCallback(async () => {
    if (!selectedWorktreePath) return

    const ptyId = await window.api.pty.spawn({ worktreePath: selectedWorktreePath })

    // Start claude CLI
    setTimeout(() => {
      window.api.pty.write(ptyId, 'claude\n')
    }, 100)

    const claudeNumber = getNextClaudeNumber(selectedWorktreePath)

    addTerminal({
      id: ptyId,
      worktreePath: selectedWorktreePath,
      title: `Claude ${claudeNumber}`,
      isClaudeSession: true,
    }, activeTerminalId)
  }, [selectedWorktreePath, addTerminal, activeTerminalId, getNextClaudeNumber])

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

  const handleOpenInIDE = useCallback(() => {
    if (selectedWorktreePath) {
      openInIDE(selectedWorktreePath)
    }
  }, [selectedWorktreePath, openInIDE])

  const handleOpenInTerminal = useCallback(() => {
    if (selectedWorktreePath) {
      openInTerminal(selectedWorktreePath)
    }
  }, [selectedWorktreePath, openInTerminal])


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
        hasTerminals={terminalsForCurrentWorktree.length > 0}
        onNewTerminal={handleNewTerminal}
        onNewClaude={handleNewClaude}
        onSplitHorizontal={handleSplitHorizontal}
        onSplitVertical={handleSplitVertical}
        canSplit={!!activeTerminalId}
        sidebarVisible={sidebarVisible}
        onToggleSidebar={onToggleSidebar}
        onOpenInIDE={handleOpenInIDE}
        ideName={ideName}
        onOpenInTerminal={handleOpenInTerminal}
        terminalName={terminalName}
      />

      <div className="terminal-container">
        {terminalsForCurrentWorktree.length === 0 ? (
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
        ) : null}
        {/* Render ALL worktrees' split panes to keep terminals mounted */}
        {worktreesWithTerminals.map(worktreePath => {
          const isCurrentWorktree = worktreePath === selectedWorktreePath
          const worktreeLayout = splitLayouts[worktreePath]
          const worktreeTerminals = allTerminals.filter(t => t.worktreePath === worktreePath)

          if (!worktreeLayout || worktreeTerminals.length === 0) return null

          return (
            <div
              key={worktreePath}
              className="worktree-terminals"
              style={isCurrentWorktree ? {} : {
                position: 'absolute',
                visibility: 'hidden',
                pointerEvents: 'none',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <SplitPane
                layout={worktreeLayout}
                activeTerminalId={activeTerminalId}
                terminals={worktreeTerminals}
                onUpdateRatio={handleUpdateRatio}
                onSelectTerminal={setActiveTerminal}
                onCloseTerminal={handleCloseTerminal}
                onMoveTerminal={handleMoveTerminal}
                draggedTerminalId={draggedTerminalId}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                isModalOpen={showSettingsModal}
              />
            </div>
          )
        })}
      </div>
    </main>
  )
}
