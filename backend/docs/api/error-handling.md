# Error Handling

Arqulat Arc uses a standardized error response format driven by a centralized `@ControllerAdvice` named `GlobalExceptionHandler`.

Instead of allowing Java runtime exceptions to bubble up to the client as messy HTML `500 Internal Server Error` pages, the backend intercepts business exceptions and maps them to appropriate HTTP status codes with a consistent JSON payload.

## Error Response Format

Every managed error returns a JSON object resembling the `ErrorResponse` DTO:

```json
{
  "status": 409,
  "error": "Conflict",
  "message": "A project with this name already exists",
  "timestamp": 1718645000000
}
```

## Exception Mappings

| Java Exception | HTTP Status | Triggered When |
|---|---|---|
| `MethodArgumentNotValidException` | `400 Bad Request` | Client sends invalid input (e.g., blank project name, null canvas color) that fails `@Valid` validation constraints. |
| `IllegalArgumentException` | `400 Bad Request` | Client attempts an illegal operation, such as deleting the very last file remaining inside a project. |
| `UnauthorizedAccessException` | `403 Forbidden` | Client requests or attempts to modify a Project or File that belongs to a different `user_id`. |
| `ResourceNotFoundException` | `404 Not Found` | Client provides a UUID that does not exist in the database. |
| `DuplicateResourceException` | `409 Conflict` | Client attempts to create or rename a project/file to a name that they are already actively using. |
| `PayloadTooLargeException` | `413 Payload Too Large` | Client attempts to sync a canvas whose JSON nodes payload exceeds the strict 5MB safety limit. |
| `Exception` (Fallback) | `500 Internal Server Error` | Any unhandled runtime exception (e.g., a database connection failure). |

## Input Validation (`400 Bad Request`)

When Jakarta Validation (`@NotBlank`, `@Size`, etc.) fails on incoming DTOs, the `GlobalExceptionHandler` intercepts the `BindingResult` and packages the field errors into the `message` property.

For example, creating a project with a blank name will yield:
```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed: {name=must not be blank}",
  "timestamp": 1718645000000
}
```
