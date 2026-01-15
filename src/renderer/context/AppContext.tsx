import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Worktree, TerminalInstance, SplitLayoutNode, SplitDirection, WorktreeSplitLayout } from '../../shared/types'

interface AppState {
  repoPath: string | null
  worktrees: Worktree[]
  selectedWorktreePath: string | null
  terminals: TerminalInstance[]
  activeTerminalId: string | null
  splitLayouts: WorktreeSplitLayout
  error: string | null
}

interface AppContextValue extends AppState {
  // Repo actions
  openRepo: () => Promise<void>

  // Worktree actions
  selectWorktree: (path: string) => void
  createWorktree: (branch: string, path: string) => Promise<void>
  refreshWorktrees: () => Promise<void>

  // Terminal actions
  addTerminal: (terminal: TerminalInstance, splitFromId?: string | null) => void
  removeTerminal: (id: string) => void
  setActiveTerminal: (id: string | null) => void
  setClaudeSession: (id: string, isClaude: boolean) => void

  // Split layout actions
  splitTerminal: (terminalId: string, direction: SplitDirection) => Promise<void>
  updateSplitRatio: (worktreePath: string, path: number[], ratio: number) => void
  moveTerminal: (worktreePath: string, sourceId: string, targetId: string, position: 'left' | 'right' | 'top' | 'bottom') => void
  getSplitLayout: (worktreePath: string) => SplitLayoutNode

  // Helpers
  getTerminalsForWorktree: (worktreePath: string) => TerminalInstance[]
  clearError: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    repoPath: null,
    worktrees: [],
    selectedWorktreePath: null,
    terminals: [],
    activeTerminalId: null,
    splitLayouts: {},
    error: null,
  })

  const openRepo = useCallback(async () => {
    try {
      const path = await window.api.git.openRepo()
      if (path) {
        const worktrees = await window.api.git.listWorktrees(path)
        setState(s => ({
          ...s,
          repoPath: path,
          worktrees,
          selectedWorktreePath: worktrees[0]?.path || null,
          error: null,
        }))
      }
    } catch (err) {
      setState(s => ({
        ...s,
        error: err instanceof Error ? err.message : 'Failed to open repository',
      }))
    }
  }, [])

  const selectWorktree = useCallback((path: string) => {
    setState(s => ({ ...s, selectedWorktreePath: path }))
  }, [])

  const createWorktree = useCallback(async (branch: string, path: string) => {
    if (!state.repoPath) return
    try {
      const worktrees = await window.api.git.createWorktree(state.repoPath, branch, path)
      setState(s => ({
        ...s,
        worktrees,
        selectedWorktreePath: path,
        error: null,
      }))
    } catch (err) {
      setState(s => ({
        ...s,
        error: err instanceof Error ? err.message : 'Failed to create worktree',
      }))
    }
  }, [state.repoPath])

  const refreshWorktrees = useCallback(async () => {
    if (!state.repoPath) return
    try {
      const worktrees = await window.api.git.listWorktrees(state.repoPath)
      setState(s => ({ ...s, worktrees }))
    } catch (err) {
      console.error('Failed to refresh worktrees:', err)
    }
  }, [state.repoPath])

  // Helper to add a terminal by splitting an existing one
  const addToLayoutBySplit = (
    layout: SplitLayoutNode,
    targetId: string,
    newTerminalId: string
  ): SplitLayoutNode => {
    if (!layout) return { type: 'terminal', terminalId: newTerminalId }
    if (layout.type === 'terminal') {
      if (layout.terminalId === targetId) {
        return {
          type: 'split',
          direction: 'horizontal',
          ratio: 0.5,
          first: layout,
          second: { type: 'terminal', terminalId: newTerminalId },
        }
      }
      return layout
    }
    return {
      ...layout,
      first: addToLayoutBySplit(layout.first, targetId, newTerminalId),
      second: addToLayoutBySplit(layout.second, targetId, newTerminalId),
    }
  }

  const addTerminal = useCallback((terminal: TerminalInstance, splitFromId?: string | null) => {
    setState(s => {
      const currentLayout = s.splitLayouts[terminal.worktreePath]
      let newLayout: SplitLayoutNode

      if (!currentLayout) {
        // First terminal for this worktree
        newLayout = { type: 'terminal', terminalId: terminal.id }
      } else if (splitFromId) {
        // Add by splitting the specified terminal
        newLayout = addToLayoutBySplit(currentLayout, splitFromId, terminal.id)
      } else {
        // Find first terminal in layout to split
        const findFirstTerminal = (node: SplitLayoutNode): string | null => {
          if (!node) return null
          if (node.type === 'terminal') return node.terminalId
          return findFirstTerminal(node.first) || findFirstTerminal(node.second)
        }
        const firstId = findFirstTerminal(currentLayout)
        if (firstId) {
          newLayout = addToLayoutBySplit(currentLayout, firstId, terminal.id)
        } else {
          newLayout = { type: 'terminal', terminalId: terminal.id }
        }
      }

      return {
        ...s,
        terminals: [...s.terminals, terminal],
        activeTerminalId: terminal.id,
        splitLayouts: {
          ...s.splitLayouts,
          [terminal.worktreePath]: newLayout,
        },
      }
    })
  }, [])

  // Helper to remove a terminal from a split layout
  const removeFromLayout = (layout: SplitLayoutNode, terminalId: string): SplitLayoutNode => {
    if (!layout) return null
    if (layout.type === 'terminal') {
      return layout.terminalId === terminalId ? null : layout
    }
    // It's a split
    const newFirst = removeFromLayout(layout.first, terminalId)
    const newSecond = removeFromLayout(layout.second, terminalId)

    // If both children are now null, return null
    if (!newFirst && !newSecond) return null
    // If one child is null, return the other
    if (!newFirst) return newSecond
    if (!newSecond) return newFirst
    // Both children exist, return updated split
    return { ...layout, first: newFirst, second: newSecond }
  }

  const removeTerminal = useCallback((id: string) => {
    setState(s => {
      const terminal = s.terminals.find(t => t.id === id)
      const newTerminals = s.terminals.filter(t => t.id !== id)
      const newActiveId = s.activeTerminalId === id
        ? newTerminals.find(t => t.worktreePath === s.selectedWorktreePath)?.id || null
        : s.activeTerminalId

      // Update split layout
      const newSplitLayouts = { ...s.splitLayouts }
      if (terminal) {
        const currentLayout = newSplitLayouts[terminal.worktreePath]
        if (currentLayout) {
          newSplitLayouts[terminal.worktreePath] = removeFromLayout(currentLayout, id)
        }
      }

      return { ...s, terminals: newTerminals, activeTerminalId: newActiveId, splitLayouts: newSplitLayouts }
    })
  }, [])

  const setActiveTerminal = useCallback((id: string | null) => {
    setState(s => ({ ...s, activeTerminalId: id }))
  }, [])

  const setClaudeSession = useCallback((id: string, isClaude: boolean) => {
    setState(s => {
      const terminal = s.terminals.find(t => t.id === id)
      if (!terminal) return s

      // Update title if becoming a Claude session and title doesn't already say Claude
      let newTitle = terminal.title
      if (isClaude && !terminal.title.startsWith('Claude')) {
        const claudeCount = s.terminals.filter(t => t.isClaudeSession && t.worktreePath === terminal.worktreePath).length + 1
        newTitle = `Claude ${claudeCount}`
      }

      return {
        ...s,
        terminals: s.terminals.map(t =>
          t.id === id ? { ...t, isClaudeSession: isClaude, title: newTitle } : t
        ),
      }
    })
  }, [])

  // Helper to find and split a terminal node in the layout
  const splitNodeInLayout = (
    layout: SplitLayoutNode,
    terminalId: string,
    direction: SplitDirection,
    newTerminalId: string
  ): SplitLayoutNode => {
    if (!layout) return null
    if (layout.type === 'terminal') {
      if (layout.terminalId === terminalId) {
        // Found the terminal to split
        return {
          type: 'split',
          direction,
          ratio: 0.5,
          first: { type: 'terminal', terminalId },
          second: { type: 'terminal', terminalId: newTerminalId },
        }
      }
      return layout
    }
    // Recursively search in split
    return {
      ...layout,
      first: splitNodeInLayout(layout.first, terminalId, direction, newTerminalId),
      second: splitNodeInLayout(layout.second, terminalId, direction, newTerminalId),
    }
  }

  const splitTerminal = useCallback(async (terminalId: string, direction: SplitDirection) => {
    const terminal = state.terminals.find(t => t.id === terminalId)
    if (!terminal) return

    // Spawn a new PTY for the new terminal
    const ptyId = await window.api.pty.spawn({ worktreePath: terminal.worktreePath })
    const termNumber = state.terminals.filter(t => t.worktreePath === terminal.worktreePath && !t.isClaudeSession).length + 1

    setState(s => {
      const currentLayout = s.splitLayouts[terminal.worktreePath]
      const newLayout = splitNodeInLayout(currentLayout, terminalId, direction, ptyId)

      return {
        ...s,
        terminals: [...s.terminals, {
          id: ptyId,
          worktreePath: terminal.worktreePath,
          title: `Terminal ${termNumber}`,
          isClaudeSession: false,
        }],
        activeTerminalId: ptyId,
        splitLayouts: {
          ...s.splitLayouts,
          [terminal.worktreePath]: newLayout,
        },
      }
    })
  }, [state.terminals])

  // Helper to update ratio at a specific path in the layout
  const updateRatioInLayout = (layout: SplitLayoutNode, path: number[], ratio: number): SplitLayoutNode => {
    if (!layout || layout.type === 'terminal') return layout
    if (path.length === 0) {
      return { ...layout, ratio }
    }
    const [head, ...rest] = path
    if (head === 0) {
      return { ...layout, first: updateRatioInLayout(layout.first, rest, ratio) }
    } else {
      return { ...layout, second: updateRatioInLayout(layout.second, rest, ratio) }
    }
  }

  const updateSplitRatio = useCallback((worktreePath: string, path: number[], ratio: number) => {
    setState(s => {
      const currentLayout = s.splitLayouts[worktreePath]
      if (!currentLayout) return s
      return {
        ...s,
        splitLayouts: {
          ...s.splitLayouts,
          [worktreePath]: updateRatioInLayout(currentLayout, path, ratio),
        },
      }
    })
  }, [])

  // Helper to insert a terminal next to another with specified position
  const insertTerminalInLayout = (
    layout: SplitLayoutNode,
    targetId: string,
    sourceId: string,
    position: 'left' | 'right' | 'top' | 'bottom'
  ): SplitLayoutNode => {
    if (!layout) return null
    if (layout.type === 'terminal') {
      if (layout.terminalId === targetId) {
        const direction: SplitDirection = (position === 'left' || position === 'right') ? 'horizontal' : 'vertical'
        const sourceNode: SplitLayoutNode = { type: 'terminal', terminalId: sourceId }
        const targetNode: SplitLayoutNode = { type: 'terminal', terminalId: targetId }

        // left/top = source first, right/bottom = source second
        const sourceFirst = position === 'left' || position === 'top'

        return {
          type: 'split',
          direction,
          ratio: 0.5,
          first: sourceFirst ? sourceNode : targetNode,
          second: sourceFirst ? targetNode : sourceNode,
        }
      }
      return layout
    }
    return {
      ...layout,
      first: insertTerminalInLayout(layout.first, targetId, sourceId, position),
      second: insertTerminalInLayout(layout.second, targetId, sourceId, position),
    }
  }

  const moveTerminal = useCallback((
    worktreePath: string,
    sourceId: string,
    targetId: string,
    position: 'left' | 'right' | 'top' | 'bottom'
  ) => {
    if (sourceId === targetId) return
    setState(s => {
      const currentLayout = s.splitLayouts[worktreePath]
      if (!currentLayout) return s

      // First remove the source terminal from its current location
      const layoutWithoutSource = removeFromLayout(currentLayout, sourceId)
      if (!layoutWithoutSource) {
        // Source was the only terminal, nothing to do
        return s
      }

      // Then insert it next to the target
      const newLayout = insertTerminalInLayout(layoutWithoutSource, targetId, sourceId, position)

      return {
        ...s,
        splitLayouts: {
          ...s.splitLayouts,
          [worktreePath]: newLayout,
        },
      }
    })
  }, [])

  const getSplitLayout = useCallback((worktreePath: string): SplitLayoutNode => {
    return state.splitLayouts[worktreePath] || null
  }, [state.splitLayouts])

  const getTerminalsForWorktree = useCallback((worktreePath: string) => {
    return state.terminals.filter(t => t.worktreePath === worktreePath)
  }, [state.terminals])

  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: null }))
  }, [])

  // Listen for Claude status changes from main process
  useEffect(() => {
    const unsubscribe = window.api.pty.onClaudeStatus?.((ptyId, isClaude) => {
      setClaudeSession(ptyId, isClaude)
    })
    return () => unsubscribe?.()
  }, [setClaudeSession])

  const value: AppContextValue = {
    ...state,
    openRepo,
    selectWorktree,
    createWorktree,
    refreshWorktrees,
    addTerminal,
    removeTerminal,
    setActiveTerminal,
    setClaudeSession,
    splitTerminal,
    updateSplitRatio,
    moveTerminal,
    getSplitLayout,
    getTerminalsForWorktree,
    clearError,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
