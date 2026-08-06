# Project Structure

Arqulat Arc follows a layered Spring Boot package architecture. The separation of concerns keeps routing, business logic, and database access isolated from one another. The Java package names still use the legacy `com.arqulat.loom_backend` path.

```text
src/main/java/com/arqulat/loom_backend/
├── LoomBackendApplication.java       # Spring Boot entry point
│
├── config/                           # Application Configuration
│   ├── SecurityConfig.java           # Disables CSRF, sets stateless sessions, registers JwtAuthenticationFilter
│   └── WebConfig.java                # Global CORS configuration mapping to app.frontend.url
│
├── controller/                       # Presentation Layer
│   ├── ProjectController.java        # REST endpoints for Workspace Projects
│   └── FileController.java           # REST endpoints for Diagram Canvases (Auto-save)
│
├── dto/                              # Data Transfer Objects
│   ├── ProjectRequests.java          # Nested records for creating/updating projects
│   ├── FileRequests.java             # Nested records for creating/updating files (includes JSONB nodes)
│   └── Responses.java                # Embedded DTOs returned to the client (e.g., ProjectSummaryDTO containing FileSummaryDTOs)
│
├── exception/                        # Global Error Handling
│   ├── GlobalExceptionHandler.java   # @ControllerAdvice mapping exceptions to JSON error formats
│   ├── ErrorResponse.java            # Standardized HTTP error payload
│   ├── DuplicateResourceException.java # Thrown on duplicate names -> mapped to 409 Conflict
│   ├── PayloadTooLargeException.java # Thrown when JSONB exceeds 5MB -> mapped to 413 Payload Too Large
│   ├── ResourceNotFoundException.java# Thrown on invalid IDs -> mapped to 404 Not Found
│   └── UnauthorizedAccessException.java # Thrown on ownership mismatch -> mapped to 403 Forbidden
│
├── model/                            # Data Access Layer (JPA Entities)
│   ├── Project.java                  # The parent project entity
│   └── DiagramFile.java              # The child canvas entity containing the JSONB nodes
│
├── repository/                       # Data Access Interfaces
│   ├── ProjectRepository.java        # Extends JpaRepository, includes custom existsBy queries
│   └── DiagramFileRepository.java    # Extends JpaRepository, includes custom existsBy queries
│
├── security/                         # Security and Authentication
│   └── JwtAuthenticationFilter.java  # Intercepts requests, extracts cookie, validates JWT, queries blacklist
│
└── service/                          # Business Logic Layer
    ├── ProjectService.java           # Validates ownership, checks name uniqueness, handles Project lifecycle
    └── FileService.java              # Enforces 5MB canvas limits, handles DiagramFile lifecycle, guards last file deletion
```

## Layer Responsibilities

- **Controllers:** Controllers contain absolutely no business logic. Their sole responsibility is defining the HTTP route (`@PostMapping`), extracting variables (`@PathVariable`), triggering Jakarta validation (`@Valid`), and handing the DTOs down to the Services.
- **Services:** This is where the core logic lives. Services perform validation checks (e.g., preventing the deletion of a project's last file), interact with multiple repositories, and perform the mapping between internal JPA Entities and outbound DTOs.
- **Repositories:** Standard Spring Data JPA interfaces. They handle all SQL translation and provide efficient index-backed query generation.
- **Exceptions:** All business constraints throw typed `RuntimeExceptions` (e.g., `DuplicateResourceException`). The `GlobalExceptionHandler` ensures that these are gracefully translated into standardized JSON error formats instead of raw 500 HTML stack traces.
