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

  // Wait for the main window (not DevTools)
  console.log('Waiting for main window...')

  let mainWindow = null
  for (let i = 0; i < 10; i++) {
    const windows = electronApp.windows()
    for (const win of windows) {
      const title = await win.title()
      const url = win.url()
      console.log(`Window ${i}: title="${title}", url="${url}"`)

      // The main window loads our app, not devtools
      if (url.includes('index.html') || url.includes('localhost')) {
        mainWindow = win
        break
      }
    }
    if (mainWindow) break
    await new Promise((r) => setTimeout(r, 500))
  }

  if (!mainWindow) {
    // Just use the first window
    mainWindow = await electronApp.firstWindow()
    console.log('Using first available window')
  }

  // Wait for the window to be ready
  await mainWindow.waitForLoadState('domcontentloaded')
  console.log('Window loaded')

  // Wait a bit for the app to render
  await new Promise((r) => setTimeout(r, 1000))

  // Take a screenshot
  try {
    await mainWindow.screenshot({ path: 'screenshots/welcome.png' })
    console.log('Screenshot saved to screenshots/welcome.png')
  } catch (e) {
    console.log('Screenshot failed:', e.message)
  }

  // Check the welcome screen content
  const h1 = await mainWindow.$('h1')
  if (h1) {
    const text = await h1.textContent()
    console.log('H1 content:', text)
  }

  // Check for welcome screen
  const welcomeScreen = await mainWindow.$('.welcome-screen')
  if (welcomeScreen) {
    console.log('Welcome screen is displayed!')
  }

  // Check for recent repos
  const recentRepos = await mainWindow.$('.recent-repos')
  if (recentRepos) {
    console.log('Recent repos section found!')
    const items = await mainWindow.$$('.recent-repos .recent-item')
    console.log(`Found ${items.length} recent repo items`)

    for (const item of items) {
      const name = await item.$('.repo-name')
      const nameText = name ? await name.textContent() : 'unknown'
      console.log(`  - ${nameText}`)
    }
  } else {
    console.log('No recent repos yet (first run)')
  }

  // Keep app open for manual debugging
  console.log('\nApp running. Press Ctrl+C to close.')
  await new Promise(() => {})
}

main().catch(console.error)
