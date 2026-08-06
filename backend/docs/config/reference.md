# Configuration Reference

The Arqulat Arc backend is configured via `application.properties` and environment variables. This file is the source of truth for database connections, limits, and security settings.

## Environment Variables & Properties

The application relies on a `.env` file (or injected system environment variables in production).

| Property Name | Env Variable | Default Value | Description |
|---|---|---|---|
| `server.port` | `PORT` | `8081` | The port the Tomcat server binds to. Set to 8081 to avoid clashing with `arqulat_auth` on 8080. |
| `spring.datasource.url` | `DATABASE_URL` | Supabase JDBC string | The PostgreSQL connection string. Must point to the shared Supabase database. |
| `spring.datasource.username` | `DATABASE_USERNAME` | `postgres` | Database username. |
| `spring.datasource.password` | `DATABASE_PASSWORD` | *(none)* | **Required.** The database password. |
| `application.security.jwt.secret-key` | `JWT_SECRET` | *(none)* | **Required.** The cryptographic secret used to verify incoming JWTs. Must EXACTLY match the secret used by `arqulat_auth`. |
| `app.cookie.domain` | `COOKIE_DOMAIN` | `.arqulat.com` | The domain scope for checking the `arqulat_session` cookie. |
| `app.frontend.url` | `FRONTEND_URL` | `http://localhost:5173` | The allowed CORS origin for the frontend React application. |

## Essential Safeguards

The following static configurations are hardcoded into `application.properties` to ensure application stability and security:

### Flyway Migrations
```properties
spring.flyway.enabled=true
spring.flyway.schemas=arc
spring.flyway.default-schema=arc
spring.jpa.hibernate.ddl-auto=update
```
Flyway initializes and maintains the `arc` schema, while Hibernate updates the mapped schema at runtime.

### Payload Size Limits
```properties
server.tomcat.max-http-form-post-size=5MB
spring.servlet.multipart.max-request-size=5MB
```
To prevent memory exhaustion attacks or database bloat from excessively massive JSONB canvases, Tomcat strictly enforces a 5 Megabyte limit on all incoming POST/PUT request payloads.

## Local `.env` Template

Create a `.env` file in the `backend` root directory for local development:

```properties
DATABASE_URL=jdbc:postgresql://<your-supabase-id>.supabase.co:5432/postgres?currentSchema=public
DATABASE_PASSWORD=your_super_secret_db_password
JWT_SECRET=the_exact_same_base64_secret_used_in_arqulat_auth
```
