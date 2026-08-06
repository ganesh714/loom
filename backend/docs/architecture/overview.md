# Architecture Overview

The Arqulat Arc backend is a Spring Boot application that operates as a stateless resource server. Its primary responsibility is managing the lifecycle of workspace projects and nested diagram canvases. Identity management and token issuance are delegated to the `arqulat_auth` service.

## Stateless Resource Server Design

The backend relies on the client providing a cryptographically signed JWT via an `HttpOnly` cookie (`arqulat_session`).
Because it is stateless:
- There is no server-side session state stored in memory.
- Every incoming request must be independently authenticated.
- The backend scales horizontally without sticky sessions, as any instance can verify the JWT payload using the shared symmetric `JWT_SECRET`.

## Canvas Storage With JSONB

The most important storage decision is how to persist diagram canvases. Modern collaborative diagrams can contain hundreds or thousands of nodes, connectors, and text blocks per canvas.

### The Problem with Relational Storage
If we used traditional JPA entities for nodes (e.g., a `Node` table mapped with `@OneToMany`), we would encounter massive overhead:
1. **N+1 Query Problems:** Fetching a canvas with 1,000 nodes would trigger massive JOINs or thousands of secondary queries.
2. **Schema Rigidity:** Diagram schemas evolve rapidly. Adding a `borderRadius` or `textShadow` property to a node would require database migrations (`ALTER TABLE`).
3. **Serialization Cost:** Hibernate would instantiate 1,000 heavy proxy objects per request, exhausting JVM heap memory during peak loads.

### The JSONB Solution
Instead, the `DiagramFile` entity uses a single PostgreSQL `JSONB` column to store the entire canvas array.
- **Performance:** PostgreSQL stores `JSONB` in a parsed binary format, allowing fast retrieval. The entire canvas is fetched in a single row read.
- **Bypassing Deserialization:** The `nodes` field is mapped as a Jackson `JsonNode`. Spring Boot can stream the raw JSON tree back to the client without expanding it into a large graph of Java POJOs.
- **Schema Flexibility:** The frontend can add, remove, or change node properties on the fly without backend migrations. The backend treats the canvas payload as an opaque block of data.

## Request Flow

When the React frontend makes a request to the Arc backend, the following execution path occurs:

1. **Tomcat Servlet Container:** Receives the HTTP request and enforces basic limits (e.g., `max-http-form-post-size=5MB` to prevent memory exhaustion).
2. **Security Filter Chain:** 
   - `JwtAuthenticationFilter` extracts the `arqulat_session` cookie.
   - It decodes the JWT using `io.jsonwebtoken`, verifying the HMAC SHA-256 signature against the `JWT_SECRET`.
   - It extracts the `uid` claim (the User's UUID) and the `jti` claim (Token ID).
   - It issues a fast, native `JdbcTemplate` query to `public.blacklisted_tokens` to ensure the token hasn't been revoked.
   - It injects a `UsernamePasswordAuthenticationToken` into the `SecurityContextHolder`.
3. **DispatcherServlet & Controller:** Maps the route to `ProjectController`. The JSON body is deserialized into a `CreateProjectRequest` DTO. Jakarta Validation (`@Valid`) executes, rejecting requests with blank names or illegal characters before they reach business logic.
4. **Service Layer (`ProjectService`):**
   - Applies business rules. For example, checking `projectRepository.existsByUserIdAndName` to enforce uniqueness. If violated, throws a `DuplicateResourceException`.
   - Constructs the `Project` entity and the initial default `DiagramFile`.
5. **Repository Layer & Hibernate:** Translates the entity graph into SQL statements. Flyway ensures the underlying tables (`projects`, `diagram_files`) are perfectly matched to the entities.
6. **Global Exception Handler:** If any error occurred (e.g., duplicate name), `GlobalExceptionHandler` intercepts it, logs a warning, and maps the Java exception to a standardized JSON error response with an appropriate HTTP status (e.g., `409 Conflict`).
