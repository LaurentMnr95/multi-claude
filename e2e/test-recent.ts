import { _electron as electron } from 'playwright'
import path from 'path'
import fs from 'fs'
import os from 'os'

async function main() {
  // Create test data in the correct location
  const configDir = path.join(os.homedir(), 'Library', 'Application Support', 'multi-claude')
  const configPath = path.join(configDir, 'config.json')

  // Backup existing config
  let existingConfig = null
  if (fs.existsSync(configPath)) {
    existingConfig = fs.readFileSync(configPath, 'utf8')
    console.log('Existing config:', existingConfig)
  }

  // The app should already have data from previous usage
  // Let's just verify the current state

  console.log('\n--- Config file location ---')
  console.log(configPath)

  console.log('\n--- Current stored data ---')
  if (existingConfig) {
    const data = JSON.parse(existingConfig)
    console.log('Recent repos count:', data.recentRepos?.length || 0)
    if (data.recentRepos?.length > 0) {
      console.log('First repo:', data.recentRepos[0].repoName)
      console.log('Last opened:', new Date(data.recentRepos[0].lastOpened).toLocaleString())
    }
  }

  console.log('\n--- Launching app to verify UI ---')

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
      if (url.includes('index.html') || url.includes('localhost')) {
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
  await new Promise((r) => setTimeout(r, 2000))

  // Check for recent repos
  const recentRepos = await mainWindow.$('.recent-repos')
  if (recentRepos) {
    console.log('\n--- Recent repos section found! ---')
    const items = await mainWindow.$$('.recent-repos .recent-item')
    console.log(`Found ${items.length} recent repo items in UI`)

    for (const item of items) {
      const name = await item.$('.repo-name')
      const nameText = name ? await name.textContent() : 'unknown'
      console.log(`  - ${nameText}`)
    }

    await mainWindow.screenshot({ path: 'screenshots/recent-repos.png' })
    console.log('\nScreenshot saved to screenshots/recent-repos.png')
  } else {
    console.log('\n--- No recent repos section in UI ---')
    console.log('This could be because:')
    console.log('1. Playwright uses a different user data directory')
    console.log('2. No repos have been opened yet')
  }

  console.log('\n--- Test complete ---')
  await electronApp.close()
}

main().catch(console.error)
