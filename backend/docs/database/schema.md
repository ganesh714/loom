# Database Schema

The Arc backend operates on the same Supabase PostgreSQL instance as `arqulat_auth` but runs in its own schema named `arc`.

## `projects` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | Primary Key | |
| `name` | `VARCHAR` | Not Null | Project name |
| `category` | `VARCHAR(100)` | | e.g. "Arc Diagrams" |
| `user_id` | `UUID` | Not Null | Foreign Key mapping to the JWT `uid` claim |
| `created_at` | `TIMESTAMP` | | |
| `updated_at` | `TIMESTAMP` | | |

## `diagram_files` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | Primary Key | |
| `name` | `VARCHAR` | Not Null | File name |
| `canvas_bg_color` | `VARCHAR(20)` | | Canvas background HEX color |
| `nodes` | `JSONB` | | The actual diagram nodes array mapped dynamically |
| `project_id` | `UUID` | Foreign Key | References `projects.id` |
| `created_at` | `TIMESTAMP` | | |
| `updated_at` | `TIMESTAMP` | | |

## Cross-Schema Query
Arc uses a native `JdbcTemplate` query to check the `public.blacklisted_tokens` table. The security layer uses this table to verify whether a JWT has been explicitly logged out.
