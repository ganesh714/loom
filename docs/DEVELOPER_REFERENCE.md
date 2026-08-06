# Arqulat Arc Developer Reference

This guide summarizes the architecture, auth model, and development workflow used by Arqulat Arc.

## System Architecture

Arqulat Arc is a full-stack workspace application with a React 19 + TypeScript + Vite frontend and a Spring Boot 3.2.6 backend on Java 17.

- The frontend owns the canvas, dashboard, guest mode, collaboration UI, and AI panel.
- The backend owns project/file persistence, authentication checks, WebSocket/STOMP sync, and API validation.
- PostgreSQL stores application data in the `arc` schema.

## Authentication and Guest Access

Authentication is delegated to `arqulat_auth`.

- The frontend uses `AuthContext` and sends requests with credentials included.
- Signed-in users receive the shared `arqulat_session` cookie.
- Guest users can browse the app, edit sample content, and interact with the canvas without persisting their work.

## Persistence and Collaboration

- Project and file data are saved in PostgreSQL and managed through Spring Data JPA.
- Collaboration uses SockJS/STOMP on the frontend and a WebSocket message broker on the backend.
- JWT revocation is checked with a Redis fast path and a PostgreSQL blacklist fallback.

## AI and Canvas Workflow

- The canvas uses custom shapes, connectors, and live previews rather than an external diagramming engine.
- The AI sidebar can generate or edit diagram content through backend endpoints.
- Version history and import/export are part of the normal editing workflow.

## Development Workflow

1. Start `arqulat_auth` if you need sign-in flows.
2. Start the backend from `backend` with `./mvnw spring-boot:run`.
3. Start the frontend from `frontend` with `npm install` and `npm run dev`.
4. Open the app at `http://localhost:5173`.
