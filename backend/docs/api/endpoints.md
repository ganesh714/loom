# API Reference

All endpoints require a valid `arqulat_session` HttpOnly cookie.

## Project API

### `GET /api/projects`
Returns a list of all projects belonging to the authenticated user.
- **Response:** `200 OK`
- **Body:** `ProjectSummaryDTO[]` (id, name, category, fileCount, files, updatedAt)

### `POST /api/projects`
Creates a new project.
- **Request Body:** `{ "name": "...", "category": "...", "backgroundColor": "..." }`
- **Response:** `201 Created` (or `409 Conflict` if name exists)
- **Body:** `ProjectSummaryDTO`

### `PUT /api/projects/{id}`
Updates an existing project.
- **Request Body:** `{ "name": "...", "category": "..." }`
- **Response:** `200 OK` (or `409 Conflict` if name exists)

### `DELETE /api/projects/{id}`
Deletes a project and all its nested files.
- **Response:** `204 No Content`

## Diagram File API

### `GET /api/projects/{projectId}/files`
Lists all files in a specific project.
- **Response:** `200 OK`
- **Body:** `FileSummaryDTO[]`

### `POST /api/projects/{projectId}/files`
Creates a new diagram file in a project.
- **Request Body:** `{ "name": "...", "backgroundColor": "..." }`
- **Response:** `201 Created` (or `409 Conflict` if name exists)

### `GET /api/files/{fileId}`
Fetches the full details of a single diagram file, including the heavy `nodes` JSON array.
- **Response:** `200 OK`
- **Body:** `FileDetailDTO`

### `PUT /api/files/{fileId}`
Updates file details (auto-save endpoint).
- **Request Body:** `{ "name": "...", "canvasBgColor": "...", "nodes": [...] }`
- **Response:** `200 OK` (or `409 Conflict` if name exists)

### `DELETE /api/files/{fileId}`
Deletes a specific diagram file.
- **Response:** `204 No Content`
