import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface Props {
  ptyId: string
  isActive: boolean
  isVisible?: boolean // If not provided, defaults to isActive (for backward compat)
}

export function TerminalPane({ ptyId, isActive, isVisible }: Props) {
  // If isVisible not provided, default to isActive (backward compat for tab-based view)
  const shouldBeVisible = isVisible ?? isActive

  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  // Track container dimensions to avoid unnecessary fits
  const lastContainerSize = useRef({ width: 0, height: 0 })
  const lastPtySize = useRef({ cols: 0, rows: 0 })
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Handle terminal input
    terminal.onData(data => {
      window.api.pty.write(ptyId, data)
    })

    // Listen for PTY output
    const unsubscribeData = window.api.pty.onData((id, data) => {
      if (id === ptyId) {
        terminal.write(data)
      }
    })

    // Listen for PTY exit
    const unsubscribeExit = window.api.pty.onExit((id, exitCode) => {
      if (id === ptyId) {
        terminal.write(`\r\n[Process exited with code ${exitCode}]\r\n`)
      }
    })

    return () => {
      unsubscribeData()
      unsubscribeExit()
      terminal.dispose()
    }
  }, [ptyId])

  // Handle resize - runs when visibility or size changes
  useEffect(() => {
    if (!containerRef.current || !terminalRef.current || !fitAddonRef.current) return
    if (!shouldBeVisible) return // Don't set up resize observer for hidden terminals

    const container = containerRef.current
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current

    // Perform fit and notify PTY if size changed
    const performFit = () => {
      try {
        fitAddon.fit()
        const { cols, rows } = terminal

        // Only notify PTY if size actually changed
        if (cols !== lastPtySize.current.cols || rows !== lastPtySize.current.rows) {
          lastPtySize.current = { cols, rows }
          window.api.pty.resize(ptyId, cols, rows)
        }
      } catch {
        // Terminal might be disposed
      }
    }

    // Debounced resize handler - waits for resize to settle
    const scheduleResize = () => {
      // Cancel any pending resize
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }

      // Schedule resize after a delay
      resizeTimeoutRef.current = setTimeout(() => {
        rafRef.current = requestAnimationFrame(performFit)
      }, 50)
    }

    // Check if container size actually changed significantly (> 5px)
    const handleContainerResize = (entries: ResizeObserverEntry[]) => {
      const entry = entries[0]
      if (!entry) return

      const { width, height } = entry.contentRect
      const lastSize = lastContainerSize.current

      // Only trigger resize if size changed by more than 5 pixels
      if (Math.abs(width - lastSize.width) > 5 || Math.abs(height - lastSize.height) > 5) {
        lastContainerSize.current = { width, height }
        scheduleResize()
      }
    }

    const resizeObserver = new ResizeObserver(handleContainerResize)
    resizeObserver.observe(container)

    // Initial fit when becoming visible
    // Use RAF to ensure DOM is ready
    rafRef.current = requestAnimationFrame(() => {
      const rect = container.getBoundingClientRect()
      lastContainerSize.current = { width: rect.width, height: rect.height }
      performFit()
    })

    // Window resize handler
    const handleWindowResize = () => {
      scheduleResize()
    }

    window.addEventListener('resize', handleWindowResize)

    return () => {
      window.removeEventListener('resize', handleWindowResize)
      resizeObserver.disconnect()
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [shouldBeVisible, ptyId])

  // Focus terminal when active
  useEffect(() => {
    if (isActive && terminalRef.current) {
      terminalRef.current.focus()
    }
  }, [isActive])

  return (
    <div
      ref={containerRef}
      className="terminal-pane"
      style={{ display: shouldBeVisible ? 'block' : 'none' }}
    />
  )
}
