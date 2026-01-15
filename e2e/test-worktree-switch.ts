import { _electron as electron } from 'playwright'
import path from 'path'

async function main() {
  console.log('Launching Electron app...')

  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../dist-electron/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  })

  // Wait for the main window
  let mainWindow = null
  for (let i = 0; i < 10; i++) {
    const windows = electronApp.windows()
    for (const win of windows) {
      const url = win.url()
      if (url.includes('index.html')) {
        mainWindow = win
        break
      }
    }
    if (mainWindow) break
    await new Promise((r) => setTimeout(r, 500))
  }

  if (!mainWindow) {
    mainWindow = await electronApp.firstWindow()
  }

  await mainWindow.waitForLoadState('domcontentloaded')
  console.log('Window loaded')
  await new Promise((r) => setTimeout(r, 1000))

  // Save a test repo session via API
  const testRepoPath = '/Users/meunier/Desktop/multi-claude'
  console.log('Setting up test repo via API...')

  await mainWindow.evaluate(async (repoPath) => {
    const worktrees = await (window as any).api.git.listWorktrees(repoPath)
    console.log('Worktrees:', worktrees)
    const session = {
      repoPath,
      repoName: 'multi-claude',
      selectedWorktreePath: worktrees[0]?.path || null,
      splitLayouts: {},
      terminals: [],
      lastOpened: Date.now(),
    }
    await (window as any).api.store.saveSession(session)
  }, testRepoPath)

  // Reload to pick up saved session
  await mainWindow.reload()
  await mainWindow.waitForLoadState('domcontentloaded')
  await new Promise((r) => setTimeout(r, 1000))

  await mainWindow.screenshot({ path: 'screenshots/01-with-recent.png' })

  // Click the recent repo
  const recentItems = await mainWindow.$$('.recent-item')
  console.log(`Found ${recentItems.length} recent repos`)

  if (recentItems.length > 0) {
    await recentItems[0].click()
    await new Promise((r) => setTimeout(r, 2000))
    await mainWindow.screenshot({ path: 'screenshots/02-repo-opened.png' })

    // Check worktrees
    const worktreeItems = await mainWindow.$$('.worktree-item')
    console.log(`Found ${worktreeItems.length} worktree items`)

    // Create a terminal
    const newTermBtn = await mainWindow.$('button:has-text("Terminal")')
    if (newTermBtn) {
      console.log('Creating terminal...')
      await newTermBtn.click()
      await new Promise((r) => setTimeout(r, 2000))
      await mainWindow.screenshot({ path: 'screenshots/03-terminal.png' })
    }

    // Get pane info
    const panes = await mainWindow.$$('.pane-header .pane-title')
    for (const pane of panes) {
      const text = await pane.textContent()
      console.log(`Terminal pane: ${text}`)
    }
  }

  console.log('\nTest complete. Press Ctrl+C to close.')
  await new Promise(() => {})
}

main().catch(console.error)
