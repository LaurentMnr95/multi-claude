import { useState, useCallback, useRef, useEffect } from 'react'
import { SplitLayoutNode, SplitDirection, TerminalInstance } from '../../shared/types'
import { TerminalPane } from './TerminalPane'

type DropZone = 'left' | 'right' | 'top' | 'bottom' | null

interface TerminalPaneWrapperProps {
  terminalId: string
  terminals: TerminalInstance[]
  activeTerminalId: string | null
  draggedTerminalId: string | null
  onSelectTerminal: (id: string) => void
  onCloseTerminal: (id: string) => void
  onDragStart: (terminalId: string) => void
  onDragEnd: () => void
  onMoveTerminal: (sourceId: string, targetId: string, position: 'left' | 'right' | 'top' | 'bottom') => void
  isModalOpen?: boolean
}

function TerminalPaneWrapper({
  terminalId,
  terminals,
  activeTerminalId,
  draggedTerminalId,
  onSelectTerminal,
  onCloseTerminal,
  onDragStart,
  onDragEnd,
  onMoveTerminal,
  isModalOpen,
}: TerminalPaneWrapperProps) {
  const [dropZone, setDropZone] = useState<DropZone>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const terminal = terminals.find(t => t.id === terminalId)
  const isActive = terminalId === activeTerminalId
  const isDragging = draggedTerminalId === terminalId
  const canDrop = draggedTerminalId && draggedTerminalId !== terminalId

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', terminalId)
    onDragStart(terminalId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!canDrop || !containerRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const width = rect.width
    const height = rect.height

    // Determine which zone based on position (20% edge zones)
    const edgeThreshold = 0.2
    const leftEdge = width * edgeThreshold
    const rightEdge = width * (1 - edgeThreshold)
    const topEdge = height * edgeThreshold
    const bottomEdge = height * (1 - edgeThreshold)

    if (x < leftEdge) {
      setDropZone('left')
    } else if (x > rightEdge) {
      setDropZone('right')
    } else if (y < topEdge) {
      setDropZone('top')
    } else if (y > bottomEdge) {
      setDropZone('bottom')
    } else {
      // Center area - use closest edge
      const distLeft = x
      const distRight = width - x
      const distTop = y
      const distBottom = height - y
      const minDist = Math.min(distLeft, distRight, distTop, distBottom)

      if (minDist === distLeft) setDropZone('left')
      else if (minDist === distRight) setDropZone('right')
      else if (minDist === distTop) setDropZone('top')
      else setDropZone('bottom')
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the container entirely
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setDropZone(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData('text/plain')
    if (sourceId && sourceId !== terminalId && dropZone) {
      onMoveTerminal(sourceId, terminalId, dropZone)
    }
    setDropZone(null)
    onDragEnd()
  }

  const handleDragEnd = () => {
    setDropZone(null)
    onDragEnd()
  }

  return (
    <div
      ref={containerRef}
      className={`split-terminal ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={() => onSelectTerminal(terminalId)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {canDrop && dropZone && (
        <div className={`drop-indicator ${dropZone}`} />
      )}
      <div
        className={`pane-header ${terminal?.isClaudeSession ? 'claude' : ''}`}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <span className="drag-handle" title="Drag to reorder">&#x2630;</span>
        <span className="pane-icon">{terminal?.isClaudeSession ? '✨' : '>'}</span>
        <span className="pane-title">{terminal?.title || 'Terminal'}</span>
        <button
          className="pane-close"
          onClick={e => {
            e.stopPropagation()
            onCloseTerminal(terminalId)
          }}
          title="Close"
        >
          ×
        </button>
      </div>
      <div className="pane-content">
        <TerminalPane
          ptyId={terminalId}
          isActive={isActive}
          isVisible={true}
          isModalOpen={isModalOpen}
        />
      </div>
    </div>
  )
}

interface SplitPaneProps {
  layout: SplitLayoutNode
  activeTerminalId: string | null
  terminals: TerminalInstance[]
  onUpdateRatio: (path: number[], ratio: number) => void
  onSelectTerminal: (id: string) => void
  onCloseTerminal: (id: string) => void
  onMoveTerminal: (sourceId: string, targetId: string, position: 'left' | 'right' | 'top' | 'bottom') => void
  draggedTerminalId: string | null
  onDragStart: (terminalId: string) => void
  onDragEnd: () => void
  path?: number[]
  isModalOpen?: boolean
}

export function SplitPane({
  layout,
  activeTerminalId,
  terminals,
  onUpdateRatio,
  onSelectTerminal,
  onCloseTerminal,
  onMoveTerminal,
  draggedTerminalId,
  onDragStart,
  onDragEnd,
  path = [],
  isModalOpen,
}: SplitPaneProps) {
  const [isResizing, setIsResizing] = useState(false)
  const [localRatio, setLocalRatio] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const ratioRef = useRef<number>(0.5)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (layout?.type === 'split') {
      setLocalRatio(layout.ratio)
      ratioRef.current = layout.ratio
    }
    setIsResizing(true)
  }, [layout])

  useEffect(() => {
    if (!isResizing || layout?.type !== 'split') return

    const direction = layout.direction

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      let ratio: number

      if (direction === 'horizontal') {
        ratio = (e.clientX - rect.left) / rect.width
      } else {
        ratio = (e.clientY - rect.top) / rect.height
      }

      ratio = Math.max(0.1, Math.min(0.9, ratio))
      // Update both ref and state
      ratioRef.current = ratio
      setLocalRatio(ratio)
    }

    const handleMouseUp = () => {
      // Commit the final ratio to parent state using ref (avoids stale closure)
      onUpdateRatio(path, ratioRef.current)
      setLocalRatio(null)
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, layout, onUpdateRatio, path])

  if (!layout) {
    return <div className="split-empty">No terminal</div>
  }

  if (layout.type === 'terminal') {
    return (
      <TerminalPaneWrapper
        terminalId={layout.terminalId}
        terminals={terminals}
        activeTerminalId={activeTerminalId}
        draggedTerminalId={draggedTerminalId}
        onSelectTerminal={onSelectTerminal}
        onCloseTerminal={onCloseTerminal}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onMoveTerminal={onMoveTerminal}
        isModalOpen={isModalOpen}
      />
    )
  }

  const { direction, ratio, first, second } = layout
  const isHorizontal = direction === 'horizontal'
  // Use local ratio during drag for smooth visual updates, otherwise use layout ratio
  const displayRatio = localRatio ?? ratio

  return (
    <div
      ref={containerRef}
      className={`split-container ${isHorizontal ? 'horizontal' : 'vertical'} ${isResizing ? 'resizing' : ''}`}
    >
      <div
        className="split-pane first"
        style={{
          [isHorizontal ? 'width' : 'height']: `calc(${displayRatio * 100}% - 2px)`,
        }}
      >
        <SplitPane
          layout={first}
          activeTerminalId={activeTerminalId}
          terminals={terminals}
          onUpdateRatio={onUpdateRatio}
          onSelectTerminal={onSelectTerminal}
          onCloseTerminal={onCloseTerminal}
          onMoveTerminal={onMoveTerminal}
          draggedTerminalId={draggedTerminalId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          path={[...path, 0]}
          isModalOpen={isModalOpen}
        />
      </div>
      <div
        className={`split-divider ${isHorizontal ? 'horizontal' : 'vertical'}`}
        onMouseDown={handleMouseDown}
      />
      <div
        className="split-pane second"
        style={{
          [isHorizontal ? 'width' : 'height']: `calc(${(1 - displayRatio) * 100}% - 2px)`,
        }}
      >
        <SplitPane
          layout={second}
          activeTerminalId={activeTerminalId}
          terminals={terminals}
          onUpdateRatio={onUpdateRatio}
          onSelectTerminal={onSelectTerminal}
          onCloseTerminal={onCloseTerminal}
          onMoveTerminal={onMoveTerminal}
          draggedTerminalId={draggedTerminalId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          path={[...path, 1]}
          isModalOpen={isModalOpen}
        />
      </div>
    </div>
  )
}
