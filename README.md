# Multi-Claude

A desktop application for managing multiple Claude Code sessions across git worktrees. Run parallel AI-assisted development workflows in isolated branches, all from a single interface.

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)

## Overview

Multi-Claude solves the challenge of running multiple Claude Code sessions simultaneously. By leveraging git worktrees, you can work on different features or experiments in parallel, each with its own dedicated Claude Code instance, without branch switching overhead.

### Key Features

- **Git Worktree Management** - Create, switch between, and manage worktrees directly from the app
- **Multiple Terminal Sessions** - Run multiple terminals per worktree with full PTY support
- **Split Pane Layout** - Split terminals horizontally or vertically, resize freely
- **Drag & Drop Terminals** - Rearrange terminal panes by dragging
- **Claude Code Detection** - Automatically detects and highlights Claude Code sessions
- **Native Performance** - Built on Electron with node-pty for true terminal emulation

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/LaurentMnr95/multi-claude.git
cd multi-claude

# Install dependencies
npm install

# Start in development mode
npm run dev
```

### Building

```bash
# Build for production
npm run build

# Package as macOS app
npx electron-builder --mac
```

## Usage

### Getting Started

1. Launch the app
2. Click **Open Repository** to select a git repository
3. The sidebar shows all existing worktrees
4. Click on a worktree to open terminals for that branch

### Managing Worktrees

- Click the **+** button next to "Worktrees" to create a new worktree
- Select an existing branch or create a new one
- Each worktree gets its own directory and terminal sessions

### Working with Terminals

| Action | How |
|--------|-----|
| New terminal | Click **+ Terminal** or **+ Claude** in the toolbar |
| Split horizontal | Click the horizontal split icon |
| Split vertical | Click the vertical split icon |
| Close terminal | Click the **×** on the terminal header |
| Rearrange | Drag terminal headers to reposition |
| Resize | Drag the dividers between panes |

### Running Claude Code

1. Open a terminal in your desired worktree
2. Run `claude` to start a Claude Code session
3. The terminal header will automatically update to show it's a Claude session
4. Run multiple Claude instances across different worktrees for parallel development

## Architecture

```
src/
├── main/                 # Electron main process
│   ├── index.ts          # App entry point, window management
│   ├── ipc/              # IPC handlers
│   │   ├── git.handlers.ts
│   │   ├── pty.handlers.ts
│   │   └── dialog.handlers.ts
│   └── services/
│       ├── GitService.ts # Git/worktree operations
│       └── PtyManager.ts # Terminal process management
├── preload/
│   └── index.ts          # Secure API bridge
├── renderer/             # React frontend
│   ├── App.tsx
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── MainArea.tsx
│   │   ├── TerminalPane.tsx
│   │   ├── SplitPane.tsx
│   │   └── ...
│   └── context/
│       └── AppContext.tsx # Global state management
└── shared/
    └── types.ts          # Shared TypeScript types
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Electron 33 |
| Frontend | React 18, TypeScript |
| Build Tool | Vite 6 |
| Terminal Emulation | xterm.js 5.5, node-pty |
| Git Operations | simple-git |

## Development

### Scripts

```bash
npm run dev          # Start dev server + Electron
npm run build        # Build for production
npm run preview      # Preview production build
```

### Project Structure

- **Main Process** (`src/main/`) - Handles system-level operations: window management, file dialogs, git commands, and PTY spawning
- **Preload** (`src/preload/`) - Exposes a secure API to the renderer via `contextBridge`
- **Renderer** (`src/renderer/`) - React app handling UI, state, and terminal rendering
- **Shared** (`src/shared/`) - TypeScript types and constants shared between processes

### IPC Channels

The app uses typed IPC channels for main/renderer communication:

```typescript
// Git operations
'git:openRepo'      // Open folder dialog, validate git repo
'git:listWorktrees' // List all worktrees
'git:createWorktree'// Create new worktree
'git:removeWorktree'// Remove worktree

// PTY operations
'pty:spawn'         // Spawn new terminal
'pty:write'         // Write to terminal
'pty:resize'        // Resize terminal
'pty:kill'          // Kill terminal
'pty:data'          // Terminal output (main → renderer)
'pty:exit'          // Terminal exit (main → renderer)
'pty:claudeStatus'  // Claude detection (main → renderer)
```

## Why Git Worktrees?

Git worktrees allow you to have multiple working directories for the same repository, each checked out to a different branch. This is perfect for AI-assisted development because:

1. **No context switching** - Each Claude instance works in its own directory
2. **No stashing required** - Uncommitted changes stay in their worktree
3. **Parallel development** - Work on multiple features simultaneously
4. **Isolated environments** - Each worktree can have different dependencies

```bash
# Traditional workflow (sequential)
git stash
git checkout feature-b
# work on feature-b
git checkout feature-a
git stash pop

# Worktree workflow (parallel)
# feature-a in ./repo
# feature-b in ./repo-feature-b
# Both active simultaneously!
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT
