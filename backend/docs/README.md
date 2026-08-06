# Arqulat Arc Backend Documentation

> **Version:** 0.0.1-SNAPSHOT
> **Framework:** Spring Boot 3.2.6 · Java 17
> **Database:** PostgreSQL (Supabase-hosted, `arc` schema)

## Documentation Index

| Document | Description |
|---|---|
| [Architecture Overview](./architecture/overview.md) | Stateless API design, canvas storage, and request flow |
| [Project Structure](./architecture/project-structure.md) | Layered package layout and code ownership boundaries |
| [API Reference](./api/endpoints.md) | Project and diagram file endpoints |
| [Error Handling](./api/error-handling.md) | Standard JSON errors and HTTP status mapping |
| [Database Schema](./database/schema.md) | `projects`, `diagram_files`, and blacklist storage |
| [Configuration Reference](./config/reference.md) | Environment variables and Spring properties |
| [Security Architecture](./security/architecture.md) | JWT validation, session cookies, and blacklist checks |
| [Known Issues & TODOs](./known-issues.md) | Open issues and historical notes |

## Quick Start

```bash
# 1. Start arqulat_auth on port 8080

# 2. Start the Arc backend
cd backend
./mvnw spring-boot:run
```

The API runs on **http://localhost:8081** by default.
