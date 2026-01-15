import Store from 'electron-store'
import { StoreSchema, RepoSessionState, AppSettings } from '../../shared/types'

const store = new Store<StoreSchema>({
  defaults: {
    recentRepos: [],
    maxRecentRepos: 10,
    settings: {
      defaultIDE: null,
      customIDECommand: null,
      defaultTerminal: null,
      customTerminalCommand: null,
    },
  },
})

export const StoreService = {
  getRecentRepos(): RepoSessionState[] {
    return store.get('recentRepos', []).sort((a, b) => b.lastOpened - a.lastOpened)
  },

  getRepoSession(repoPath: string): RepoSessionState | null {
    const repos = store.get('recentRepos', [])
    return repos.find((r) => r.repoPath === repoPath) || null
  },

  saveSession(session: RepoSessionState): void {
    const repos = store.get('recentRepos', [])
    const maxRepos = store.get('maxRecentRepos', 10)

    // Remove existing entry for this repo
    const filtered = repos.filter((r) => r.repoPath !== session.repoPath)

    // Add new session at front
    const updated = [session, ...filtered].slice(0, maxRepos)

    store.set('recentRepos', updated)
  },

  removeRepo(repoPath: string): void {
    const repos = store.get('recentRepos', [])
    store.set(
      'recentRepos',
      repos.filter((r) => r.repoPath !== repoPath)
    )
  },

  getSettings(): AppSettings {
    return store.get('settings', {
      defaultIDE: null,
      customIDECommand: null,
      defaultTerminal: null,
      customTerminalCommand: null,
    })
  },

  setSettings(settings: Partial<AppSettings>): void {
    const current = this.getSettings()
    store.set('settings', { ...current, ...settings })
  },
}
