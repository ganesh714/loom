# Arqulat Arc Frontend Architecture

## Overview

Arqulat Arc is a React-based workspace for building architectural diagrams, UI wireframes, and collaborative canvas edits. The frontend uses Vite and TypeScript and is organized around route-level shells plus shared React contexts.

## Core Technologies

- **Framework:** React 19
- **Build Tool:** Vite
- **Styling:** CSS Modules, vanilla CSS, and utility classes where appropriate
- **Icons:** Lucide React
- **State Management:** React Context via `DiagramContext`, `AuthContext`, and `CollaborationContext`

## App Shell

`App.tsx` routes users between the landing page, dashboard, and workspace.

- Authenticated users and guests can enter the dashboard and workspace directly.
- The workspace shell composes the project sidebar, canvas, left tools, right panels, AI sidebar, and version history.
- Command palette shortcuts are handled at the top level so they work across routes.

## State Management

`DiagramContext` owns project, file, node, and theme state.

- `WorkspaceProject` groups files under a project.
- `DiagramFile` stores the canvas payload and background settings.
- Canvas mutations, autosave, and version history restoration all flow through this context.

## Authentication and Guest Mode

`AuthContext` delegates sign-in to `arqulat_auth` and exposes a lightweight guest flow.

- Signed-in sessions rely on the shared `arqulat_session` cookie.
- Guest mode lets users explore the app without saving to the backend.
- UI surfaces such as the header and project sidebar adapt their labels and actions based on the auth state.

## Canvas and Collaboration

The canvas is built with custom DOM/SVG rendering rather than a third-party diagram engine.

- Shapes, connectors, and selection outlines are drawn directly from app state.
- Live previews show the geometry while a user is dragging out a new node.
- `CollaborationContext` connects through SockJS/STOMP and streams remote cursor and action updates.

## AI and Productivity Features

The AI sidebar provides diagram generation and edit actions backed by the backend API.

- Speech-to-text is wired into the browser speech APIs where available.
- The command palette surfaces common workspace actions.
- Export, import, and version history are integrated into the workspace flow rather than isolated dialogs.
