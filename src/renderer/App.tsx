import { useState, useCallback, useRef, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Sidebar } from './components/Sidebar'
import { MainArea } from './components/MainArea'
import { SettingsModal } from './components/SettingsModal'
import './styles.css'

function AppContent() {
  const { repoPath, error, clearError, openRepo, openRecentRepo, recentRepos, showSettingsModal, closeSettings } = useApp()
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = Math.max(150, Math.min(500, e.clientX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  const toggleSidebar = useCallback(() => {
    setSidebarVisible(prev => !prev)
  }, [])

  if (!repoPath) {
    return (
      <div className="welcome-screen">
        <div className="welcome-content">
          <h1>Multi-Claude</h1>
          <p>Manage Claude Code sessions across git worktrees</p>
          <button className="btn-primary" onClick={openRepo}>
            Open Repository
          </button>

          {recentRepos.length > 0 && (
            <div className="recent-repos">
              <h3>Recent</h3>
              <ul className="recent-list">
                {recentRepos.map(repo => (
                  <li key={repo.repoPath}>
                    <button
                      className="recent-item"
                      onClick={() => openRecentRepo(repo.repoPath)}
                    >
                      <span className="repo-name">{repo.repoName}</span>
                      <span className="repo-path">{repo.repoPath}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`app-layout ${isResizing ? 'resizing' : ''}`}>
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>×</button>
        </div>
      )}
      <div
        ref={sidebarRef}
        className={`sidebar-container ${sidebarVisible ? '' : 'hidden'}`}
        style={{ width: sidebarVisible ? sidebarWidth : 0 }}
      >
        <Sidebar />
        <div
          className="resize-handle"
          onMouseDown={handleMouseDown}
        />
      </div>
      <MainArea sidebarVisible={sidebarVisible} onToggleSidebar={toggleSidebar} />
      {showSettingsModal && <SettingsModal onClose={closeSettings} />}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
