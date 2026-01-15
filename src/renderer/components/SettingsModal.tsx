import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { IDE_OPTIONS, IDEType, TERMINAL_OPTIONS, TerminalAppType } from '../../shared/types'

interface Props {
  onClose: () => void
}

export function SettingsModal({ onClose }: Props) {
  const { settings, updateSettings } = useApp()
  const [selectedIDE, setSelectedIDE] = useState<IDEType | ''>('')
  const [customCommand, setCustomCommand] = useState('')
  const [selectedTerminal, setSelectedTerminal] = useState<TerminalAppType | ''>('')
  const [customTerminalCommand, setCustomTerminalCommand] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (settings) {
      setSelectedIDE(settings.defaultIDE || '')
      setCustomCommand(settings.customIDECommand || '')
      setSelectedTerminal(settings.defaultTerminal || '')
      setCustomTerminalCommand(settings.customTerminalCommand || '')
    }
  }, [settings])

  async function handleSave() {
    setIsSaving(true)
    try {
      await updateSettings({
        defaultIDE: selectedIDE || null,
        customIDECommand: selectedIDE === 'custom' ? customCommand : null,
        defaultTerminal: selectedTerminal || null,
        customTerminalCommand: selectedTerminal === 'custom' ? customTerminalCommand : null,
      })
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const ideValid = selectedIDE !== 'custom' || customCommand.trim() !== ''
  const terminalValid = selectedTerminal !== 'custom' || customTerminalCommand.trim() !== ''
  const isValid = ideValid && terminalValid

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Settings</h3>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Default IDE</label>
            <select
              autoFocus
              value={selectedIDE}
              onChange={e => setSelectedIDE(e.target.value as IDEType | '')}
              disabled={isSaving}
            >
              <option value="">Select an IDE...</option>
              {IDE_OPTIONS.map(ide => (
                <option key={ide.type} value={ide.type}>{ide.name}</option>
              ))}
              <option value="custom">Custom...</option>
            </select>
          </div>

          {selectedIDE === 'custom' && (
            <div className="form-group">
              <label>Custom IDE Command</label>
              <input
                type="text"
                value={customCommand}
                onChange={e => setCustomCommand(e.target.value)}
                placeholder="e.g., /path/to/editor or editor-command"
                disabled={isSaving}
              />
              <small className="form-hint">
                Enter the command to launch your IDE (will be called with the worktree path)
              </small>
            </div>
          )}

          <div className="form-group">
            <label>External Terminal</label>
            <select
              value={selectedTerminal}
              onChange={e => setSelectedTerminal(e.target.value as TerminalAppType | '')}
              disabled={isSaving}
            >
              <option value="">Select a terminal app...</option>
              {TERMINAL_OPTIONS.map(term => (
                <option key={term.type} value={term.type}>{term.name}</option>
              ))}
              <option value="custom">Custom...</option>
            </select>
          </div>

          {selectedTerminal === 'custom' && (
            <div className="form-group">
              <label>Custom Terminal Command</label>
              <input
                type="text"
                value={customTerminalCommand}
                onChange={e => setCustomTerminalCommand(e.target.value)}
                placeholder="e.g., /path/to/terminal or terminal-command"
                disabled={isSaving}
              />
              <small className="form-hint">
                Enter the command to launch your terminal (will be called with the worktree path)
              </small>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={isSaving || !isValid}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
