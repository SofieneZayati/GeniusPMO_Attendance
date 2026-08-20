# LeadX Attendance architecture

## Source of truth

The Genius PMO HRMS FastAPI backend and PostgreSQL database remain the only source of truth. The mobile app cannot choose an employee work mode and does not own employee or attendance data.

## Production request flow

```text
LeadX Attendance
      |
      | HTTPS + employee bearer session
      v
Company reverse proxy
      |
      | replaces X-Forwarded-For with the observed client chain
      v
Genius PMO HRMS FastAPI
      |
      v
PostgreSQL
```

The normal public HTTPS API serves authentication, profile data, protected photos, schedule/work mode, attendance readiness, and check-in/check-out.

## Office network authorization

FastAPI determines the original client address from the direct connection. Forwarded addresses are considered only when the direct peer belongs to `TRUSTED_PROXY_NETWORKS`. The trusted proxy chain is evaluated from right to left so a client-controlled left-side value cannot override the address observed by the boundary proxy.

The resolved address must belong to `OFFICE_TRUSTED_NETWORKS`. Empty lists fail closed. A deployment may approve the company's fixed public egress address, or use split DNS/a local proxy path that preserves an approved private client address.

The mobile readiness response includes `office_network_verified`, `can_check_in`, and `can_check_out`. These fields control button feedback, but the write endpoints independently repeat the same network and HRMS schedule checks.

## Work-mode behavior

- Office: requires server-verified approved network membership.
- Remote: allowed through the public HTTPS API when the HRMS schedule permits it.
- External site: allowed through the public HTTPS API when the HRMS schedule permits it.
- Leave or not scheduled: rejected.

All accepted writes are recorded as the `mobile` attendance method while historical `fingerprint`, `card`, `manual`, and `import` methods remain valid.

## Development and preview

Expo Go derives the development host from Expo runtime configuration. Preview/internal APKs may scan the current private IPv4 subnet for the HRMS health endpoint when LAN discovery is enabled. The backend still decides whether the connection is an approved Office network; discovering a private-looking URL is never authorization.

Production builds use `EXPO_PUBLIC_API_BASE_URL=https://REAL-COMPANY-API/api/v1` and reject an invalid production endpoint during Expo configuration.
