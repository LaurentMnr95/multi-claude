import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { Worktree, TerminalInstance, SplitLayoutNode, SplitDirection, WorktreeSplitLayout, RepoSessionState, AppSettings, ClaudeStatus } from '../../shared/types'

// Track terminal/claude numbering per worktree
interface WorktreeCounters {
  [worktreePath: string]: { terminal: number; claude: number }
}

// Track last active terminal per worktree (for restoring on switch)
interface ActiveTerminalPerWorktree {
  [worktreePath: string]: string | null
}

interface AppState {
  repoPath: string | null
  worktrees: Worktree[]
  selectedWorktreePath: string | null
  terminals: TerminalInstance[]
  activeTerminalId: string | null
  splitLayouts: WorktreeSplitLayout
  error: string | null
  recentRepos: RepoSessionState[]
  settings: AppSettings | null
  showSettingsModal: boolean
  terminalCounters: WorktreeCounters
  activeTerminalPerWorktree: ActiveTerminalPerWorktree
}

interface AppContextValue extends AppState {
  // Repo actions
  openRepo: () => Promise<void>
  openRecentRepo: (repoPath: string) => Promise<void>

  // Worktree actions
  selectWorktree: (path: string) => void
  createWorktree: (branch: string, path: string, createBranch?: boolean, startPoint?: string) => Promise<void>
  removeWorktree: (worktreePath: string) => Promise<void>
  refreshWorktrees: () => Promise<void>

  // Terminal actions
  addTerminal: (terminal: TerminalInstance, splitFromId?: string | null) => void
  removeTerminal: (id: string) => void
  setActiveTerminal: (id: string | null) => void
  setClaudeSession: (id: string, isClaude: boolean, status?: ClaudeStatus) => void
  getNextTerminalNumber: (worktreePath: string) => number
  getNextClaudeNumber: (worktreePath: string) => number

  // Split layout actions
  splitTerminal: (terminalId: string, direction: SplitDirection) => Promise<void>
  updateSplitRatio: (worktreePath: string, path: number[], ratio: number) => void
  moveTerminal: (worktreePath: string, sourceId: string, targetId: string, position: 'left' | 'right' | 'top' | 'bottom') => void
  getSplitLayout: (worktreePath: string) => SplitLayoutNode

  // Helpers
  getTerminalsForWorktree: (worktreePath: string) => TerminalInstance[]
  clearError: () => void

  // Settings actions
  loadSettings: () => Promise<void>
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>
  openSettings: () => void
  closeSettings: () => void

  // IDE actions
  openInIDE: (path: string) => Promise<void>

  // Terminal actions
  openInTerminal: (path: string) => Promise<void>
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
    recentRepos: [],
    settings: null,
    showSettingsModal: false,
    terminalCounters: {},
    activeTerminalPerWorktree: {},
  })

  // Track if we should skip saving (during restore)
  const skipSaveRef = useRef(false)

  // Track terminal/claude counters per worktree (using refs to avoid race conditions)
  const terminalCountersRef = useRef<WorktreeCounters>({})

  const getNextTerminalNumber = useCallback((worktreePath: string): number => {
    if (!terminalCountersRef.current[worktreePath]) {
      terminalCountersRef.current[worktreePath] = { terminal: 0, claude: 0 }
    }
    terminalCountersRef.current[worktreePath].terminal += 1
    return terminalCountersRef.current[worktreePath].terminal
  }, [])

  const getNextClaudeNumber = useCallback((worktreePath: string): number => {
    if (!terminalCountersRef.current[worktreePath]) {
      terminalCountersRef.current[worktreePath] = { terminal: 0, claude: 0 }
    }
    terminalCountersRef.current[worktreePath].claude += 1
    return terminalCountersRef.current[worktreePath].claude
  }, [])

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
    setState(s => {
      // Save current active terminal for the current worktree
      const newActivePerWorktree = { ...s.activeTerminalPerWorktree }
      if (s.selectedWorktreePath && s.activeTerminalId) {
        newActivePerWorktree[s.selectedWorktreePath] = s.activeTerminalId
      }

      // Restore active terminal for the new worktree, or pick first terminal
      const terminalsForNewWorktree = s.terminals.filter(t => t.worktreePath === path)
      const savedActiveId = newActivePerWorktree[path]
      const newActiveId = savedActiveId && terminalsForNewWorktree.some(t => t.id === savedActiveId)
        ? savedActiveId
        : terminalsForNewWorktree[0]?.id || null

      return {
        ...s,
        selectedWorktreePath: path,
        activeTerminalId: newActiveId,
        activeTerminalPerWorktree: newActivePerWorktree,
      }
    })
  }, [])

  const createWorktree = useCallback(async (branch: string, path: string, createBranch?: boolean, startPoint?: string) => {
    if (!state.repoPath) return
    try {
      const worktrees = await window.api.git.createWorktree(state.repoPath, branch, path, createBranch, startPoint)
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

  const removeWorktree = useCallback(async (worktreePath: string) => {
    if (!state.repoPath) return
    try {
      // Kill all terminals for this worktree first
      const terminalsToKill = state.terminals.filter(t => t.worktreePath === worktreePath)
      for (const terminal of terminalsToKill) {
        await window.api.pty.kill(terminal.id)
      }

      // Remove the worktree
      const worktrees = await window.api.git.removeWorktree(state.repoPath, worktreePath)

      setState(s => {
        // Clean up terminals for this worktree
        const newTerminals = s.terminals.filter(t => t.worktreePath !== worktreePath)

        // Clean up split layout for this worktree
        const newSplitLayouts = { ...s.splitLayouts }
        delete newSplitLayouts[worktreePath]

        // Select a different worktree if the deleted one was selected
        let newSelectedPath = s.selectedWorktreePath
        if (s.selectedWorktreePath === worktreePath) {
          newSelectedPath = worktrees[0]?.path || null
        }

        // Update active terminal if it was in the deleted worktree
        let newActiveTerminalId = s.activeTerminalId
        if (terminalsToKill.some(t => t.id === s.activeTerminalId)) {
          newActiveTerminalId = newTerminals.find(t => t.worktreePath === newSelectedPath)?.id || null
        }

        return {
          ...s,
          worktrees,
          selectedWorktreePath: newSelectedPath,
          terminals: newTerminals,
          activeTerminalId: newActiveTerminalId,
          splitLayouts: newSplitLayouts,
          error: null,
        }
      })
    } catch (err) {
      setState(s => ({
        ...s,
        error: err instanceof Error ? err.message : 'Failed to remove worktree',
      }))
    }
  }, [state.repoPath, state.terminals])

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
    setState(s => {
      // Also update per-worktree tracking
      if (id && s.selectedWorktreePath) {
        return {
          ...s,
          activeTerminalId: id,
          activeTerminalPerWorktree: {
            ...s.activeTerminalPerWorktree,
            [s.selectedWorktreePath]: id,
          },
        }
      }
      return { ...s, activeTerminalId: id }
    })
  }, [])

  const setClaudeSession = useCallback((id: string, isClaude: boolean, status?: ClaudeStatus) => {
    // Find terminal first to get worktreePath for counter
    const terminal = state.terminals.find(t => t.id === id)
    if (!terminal) return

    // Get next claude number outside setState if needed
    const claudeNumber = isClaude && !terminal.title.startsWith('Claude')
      ? getNextClaudeNumber(terminal.worktreePath)
      : null

    setState(s => {
      const term = s.terminals.find(t => t.id === id)
      if (!term) return s

      // Update title if becoming a Claude session and title doesn't already say Claude
      const newTitle = claudeNumber !== null ? `Claude ${claudeNumber}` : term.title

      return {
        ...s,
        terminals: s.terminals.map(t =>
          t.id === id ? { ...t, isClaudeSession: isClaude, title: newTitle, claudeStatus: status ?? t.claudeStatus } : t
        ),
      }
    })
  }, [state.terminals, getNextClaudeNumber])

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
    const termNumber = getNextTerminalNumber(terminal.worktreePath)

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
          claudeStatus: null,
        }],
        activeTerminalId: ptyId,
        splitLayouts: {
          ...s.splitLayouts,
          [terminal.worktreePath]: newLayout,
        },
      }
    })
  }, [state.terminals, getNextTerminalNumber])

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

  // Settings actions
  const loadSettings = useCallback(async () => {
    const settings = await window.api.settings.get()
    setState(s => ({ ...s, settings }))
  }, [])

  const updateSettings = useCallback(async (settings: Partial<AppSettings>) => {
    await window.api.settings.set(settings)
    const updatedSettings = await window.api.settings.get()
    setState(s => ({ ...s, settings: updatedSettings }))
  }, [])

  const openSettings = useCallback(() => {
    setState(s => ({ ...s, showSettingsModal: true }))
  }, [])

  const closeSettings = useCallback(() => {
    setState(s => ({ ...s, showSettingsModal: false }))
  }, [])

  const openInIDE = useCallback(async (path: string) => {
    try {
      await window.api.ide.openPath(path)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message === 'NO_IDE_CONFIGURED') {
        setState(s => ({
          ...s,
          showSettingsModal: true,
          error: 'Please configure your default IDE in settings',
        }))
      } else {
        setState(s => ({
          ...s,
          error: message || 'Failed to open in IDE',
        }))
      }
    }
  }, [])

  const openInTerminal = useCallback(async (path: string) => {
    try {
      await window.api.terminalApp.openPath(path)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message === 'NO_TERMINAL_CONFIGURED') {
        setState(s => ({
          ...s,
          showSettingsModal: true,
          error: 'Please configure your external terminal in settings',
        }))
      } else {
        setState(s => ({
          ...s,
          error: message || 'Failed to open external terminal',
        }))
      }
    }
  }, [])

  // Load recent repos and open a recent repo with session restore
  const openRecentRepo = useCallback(async (repoPath: string) => {
    try {
      // Get saved session
      const session = await window.api.store.getRepoSession(repoPath)

      // Fetch fresh worktrees
      const worktrees = await window.api.git.listWorktrees(repoPath)

      if (!session) {
        // No saved session, just open the repo fresh
        setState(s => ({
          ...s,
          repoPath,
          worktrees,
          selectedWorktreePath: worktrees[0]?.path || null,
          terminals: [],
          activeTerminalId: null,
          splitLayouts: {},
          error: null,
        }))
        return
      }

      // Validate selectedWorktreePath still exists
      const validSelectedPath = worktrees.some(w => w.path === session.selectedWorktreePath)
        ? session.selectedWorktreePath
        : worktrees[0]?.path || null

      // Skip saving during restore
      skipSaveRef.current = true

      // Set repo state first
      setState(s => ({
        ...s,
        repoPath,
        worktrees,
        selectedWorktreePath: validSelectedPath,
        terminals: [],
        activeTerminalId: null,
        splitLayouts: {},
        error: null,
      }))

      // Restore terminals by spawning new PTYs
      const newTerminals: TerminalInstance[] = []
      const terminalIdMap = new Map<string, string>() // old ID -> new ID

      for (const savedTerminal of session.terminals) {
        // Validate worktree still exists
        if (!worktrees.some(w => w.path === savedTerminal.worktreePath)) {
          continue
        }

        try {
          const newPtyId = await window.api.pty.spawn({ worktreePath: savedTerminal.worktreePath })
          newTerminals.push({
            id: newPtyId,
            worktreePath: savedTerminal.worktreePath,
            title: savedTerminal.title,
            isClaudeSession: savedTerminal.isClaudeSession,
            claudeStatus: savedTerminal.claudeStatus ?? null,
          })
          // We'll need to map old terminal IDs in the layout to new ones
          // For now, we'll rebuild the layout from scratch
        } catch (err) {
          console.error('Failed to restore terminal:', err)
        }
      }

      // Rebuild split layouts with new terminal IDs
      // For simplicity, we just create a layout based on restored terminals per worktree
      const newSplitLayouts: WorktreeSplitLayout = {}
      const terminalsByWorktree = new Map<string, TerminalInstance[]>()

      for (const terminal of newTerminals) {
        const existing = terminalsByWorktree.get(terminal.worktreePath) || []
        existing.push(terminal)
        terminalsByWorktree.set(terminal.worktreePath, existing)
      }

      for (const [worktreePath, terminals] of terminalsByWorktree) {
        if (terminals.length === 1) {
          newSplitLayouts[worktreePath] = { type: 'terminal', terminalId: terminals[0].id }
        } else if (terminals.length > 1) {
          // Create horizontal splits for multiple terminals
          let layout: SplitLayoutNode = { type: 'terminal', terminalId: terminals[0].id }
          for (let i = 1; i < terminals.length; i++) {
            layout = {
              type: 'split',
              direction: 'horizontal',
              ratio: 0.5,
              first: layout,
              second: { type: 'terminal', terminalId: terminals[i].id },
            }
          }
          newSplitLayouts[worktreePath] = layout
        }
      }

      setState(s => ({
        ...s,
        terminals: newTerminals,
        activeTerminalId: newTerminals[0]?.id || null,
        splitLayouts: newSplitLayouts,
      }))

      // Re-enable saving after a short delay
      setTimeout(() => {
        skipSaveRef.current = false
      }, 100)
    } catch (err) {
      setState(s => ({
        ...s,
        error: err instanceof Error ? err.message : 'Failed to open repository',
      }))
    }
  }, [])

  // Load recent repos and settings on mount
  useEffect(() => {
    window.api.store.getRecentRepos().then(repos => {
      setState(s => ({ ...s, recentRepos: repos }))
    })
    loadSettings()
  }, [loadSettings])

  // Debounced save session on state changes
  useEffect(() => {
    if (!state.repoPath || skipSaveRef.current) return

    const timeoutId = setTimeout(() => {
      const session: RepoSessionState = {
        repoPath: state.repoPath!,
        repoName: state.repoPath!.split('/').pop() || 'Repository',
        selectedWorktreePath: state.selectedWorktreePath,
        splitLayouts: state.splitLayouts,
        terminals: state.terminals.map(t => ({
          worktreePath: t.worktreePath,
          title: t.title,
          isClaudeSession: t.isClaudeSession,
          claudeStatus: t.claudeStatus,
        })),
        lastOpened: Date.now(),
      }
      window.api.store.saveSession(session).then(() => {
        // Refresh recent repos list
        window.api.store.getRecentRepos().then(repos => {
          setState(s => ({ ...s, recentRepos: repos }))
        })
      })
    }, 2000)

    return () => clearTimeout(timeoutId)
  }, [state.repoPath, state.selectedWorktreePath, state.splitLayouts, state.terminals])

  // Listen for Claude status changes from main process
  useEffect(() => {
    const unsubscribe = window.api.pty.onClaudeStatus?.((ptyId, isClaude, status) => {
      setClaudeSession(ptyId, isClaude, status)
    })
    return () => unsubscribe?.()
  }, [setClaudeSession])

  const value: AppContextValue = {
    ...state,
    openRepo,
    openRecentRepo,
    selectWorktree,
    createWorktree,
    removeWorktree,
    refreshWorktrees,
    addTerminal,
    removeTerminal,
    setActiveTerminal,
    setClaudeSession,
    getNextTerminalNumber,
    getNextClaudeNumber,
    splitTerminal,
    updateSplitRatio,
    moveTerminal,
    getSplitLayout,
    getTerminalsForWorktree,
    clearError,
    loadSettings,
    updateSettings,
    openSettings,
    closeSettings,
    openInIDE,
    openInTerminal,
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
