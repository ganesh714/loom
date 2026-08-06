# Security Architecture

The authentication model relies heavily on the `arqulat_auth` service. Arqulat Arc is a resource server that validates sessions and blacklist state locally.

## The JWT Flow
1. User logs in at `accounts.arqulat.com`
2. `arqulat_auth` sets an HttpOnly cookie `arqulat_session` scoped to `.arqulat.com`
3. Browser auto-includes this cookie when requesting the Arc frontend and backend
4. `JwtAuthenticationFilter` reads the cookie, verifies the cryptographic signature, extracts the `uid` claim to identify the user's UUID, and authenticates the user.

## Shared Secret
To avoid network hops for every request, the backend verifies the JWT signature locally using the same `JWT_SECRET` injected into `application.properties`.

## Blacklist Checks

JWT revocation uses a Redis fast path and a PostgreSQL fallback.

- The backend checks Redis first for the token `jti`.
- If Redis misses or fails, it falls back to the `public.blacklisted_tokens` table.
- This keeps logout checks fast while still preserving correctness.

## Flawless Logout
If a user logs out at `accounts.arqulat.com`, their JWT ID (`jti`) is added to the `blacklisted_tokens` table in the `public` schema.
The backend verifies that the `jti` is not in this blacklist on every request, ensuring that intercepted tokens are invalidated across services.
