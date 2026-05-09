# AetherForge IDE

AetherForge IDE is a next-generation hybrid desktop IDE built with Electron, React, and TypeScript.

It is designed around three tightly connected workflows:

- Code Mode: Monaco-powered source editing for full-code control
- Visual Canvas: drag-and-drop graph workflow composition
- AI Agents: architecture, implementation, and quality automation

## Tech Stack

- Desktop shell: Electron
- Frontend: React 19 + Vite
- Language: TypeScript
- Editor: Monaco Editor
- State: Zustand
- Canvas: React Flow
- Terminal: xterm.js
- UI system: Tailwind CSS + shadcn/ui primitives

## Quick Start

1. Install dependencies:

   npm install

2. Start development mode:

   npm run dev

3. Build production bundles:

   npm run build

4. Run built Electron app preview:

   npm run electron:preview

5. Package distributables:

   npm run dist

## Project Structure

aetherforge-ide/

- electron/ Electron main process and preload bridge
- src/
  - main/ Future app runtime and domain bootstrap
  - renderer/ React UI shell and feature modules
  - common/ Shared cross-process types and contracts
  - components/ Shared UI components (shadcn-ready)
  - editor/ Editor domain module boundary
  - canvas/ Visual canvas domain module boundary
  - ai/ AI orchestration domain module boundary
  - services/ Cross-cutting services and adapters
- public/ Static assets
- extensions/ Future plugin/extensions SDK and manifests

## Recommended Next Build Steps

- Add a file tree + workspace/project abstraction layer
- Wire xterm.js to a real PTY backend (node-pty)
- Add multi-agent orchestration with execution traces
- Add extension manifest format and runtime loading
- Introduce persistence (project state, tabs, layouts)
