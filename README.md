# Arqulat Arc

Arqulat Arc is a collaborative diagramming workspace for architectural diagrams, UI wireframes, and AI-assisted design iteration. The app pairs a React canvas editor with a Spring Boot backend for projects, files, collaboration, and versioned saves.

## What It Does

- Diagram canvas with custom shapes, connectors, live draw previews, and drag-and-drop editing.
- Dashboard for creating and organizing projects and diagram files.
- Real-time collaboration with WebSocket/STOMP cursors and shared canvas actions.
- Guest access for trying the workspace without a full account.
- AI-assisted editing, command palette actions, version history, and import/export flows.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, CSS Modules, Lucide React, React Router, SockJS/STOMP.
- **Backend:** Spring Boot 3.2.6, Java 17, Spring Security, Spring Data JPA, WebSocket/STOMP, Redis, PostgreSQL.
- **Auth:** `arqulat_auth` provides the shared session cookie used by the Arc app.

## Getting Started

### Frontend
1. Open `frontend`.
2. Install dependencies with `npm install`.
3. Start the dev server with `npm run dev`.
4. Build the app with `npm run build`.

### Backend
1. Open `backend`.
2. Configure the required environment variables in `.env` or your deployment environment.
3. Start the API with `./mvnw spring-boot:run`.

## Repository Layout

- `frontend/` - React application and UI components.
- `backend/` - Spring Boot API, WebSocket broker, and persistence layer.
- `docs/` - Frontend and developer-facing reference material.
- `backend/docs/` - Backend architecture, API, configuration, database, and security docs.

## Notes

The frontend runs on `http://localhost:5173` and the backend runs on `http://localhost:8081` by default.
