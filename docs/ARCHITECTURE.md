# Genius PMO Attendance — architecture

## Purpose

This is a small employee attendance companion, not a mobile copy of the HRMS.

The mobile app exposes only:

- HRMS employee sign-in
- basic work profile
- today's approved work mode and schedule
- attendance status
- check-in and check-out

## Source of truth

The existing `GeniusPMO_HRMS` FastAPI backend and PostgreSQL database remain the only source of truth. This repository must not introduce a second employee database or an independent attendance backend.

## HRMS connection

### Development

During normal Expo development, the app derives the development PC host from Expo's runtime configuration and targets the HRMS backend on port `8000`. This avoids storing a different LAN IP every time the developer changes network.

An explicit `EXPO_PUBLIC_API_BASE_URL` remains a fallback when automatic development resolution is not possible, for example when Expo tunnel mode is used or the backend runs on another machine.

### Production

The release build uses one permanent public HTTPS HRMS API endpoint configured through `EXPO_PUBLIC_API_BASE_URL`. The mobile app therefore does not need to discover the production HRMS server on the local network.

```text
Mobile app ── HTTPS ──> public HRMS FastAPI ──> PostgreSQL
```

The same endpoint serves login, profile, today's schedule/work mode, and non-office attendance operations from any network.

## Attendance authorization

The mobile app never decides whether an employee is remote, external, or office-based. It asks the HRMS backend for today's approved assignment.

- **Office:** check-in/out requires proof through an office-only LAN attendance gateway.
- **Remote:** check-in/out is accepted by the public HRMS API only when today's approved assignment is remote.
- **External site:** check-in/out is accepted by the public HRMS API only when today's approved assignment is external.
- **Leave / not scheduled:** attendance actions are rejected.

No Face ID, fingerprint, or phone biometric capability is required.

## Request flow

Normal authenticated mobile traffic:

```text
Mobile app
   |
   | HTTPS authenticated employee bearer session
   v
Genius PMO HRMS FastAPI
   |
   +--> employee profile
   +--> today's schedule/work assignment
   +--> attendance state and authorization
   |
   v
Existing PostgreSQL records
```

Office attendance adds a separate local proof path:

```text
Mobile app -> trusted office LAN gateway -> HRMS FastAPI -> PostgreSQL
```

The gateway is not the HRMS backend and does not own employee data. Its only purpose is to prove that an office attendance action originated through an approved company network/site. The HRMS backend must reject direct office attendance writes without valid gateway proof.

## Security direction for the office gateway

Discovering a service on the LAN is not enough to trust it. A future gateway should be registered with the HRMS and use short-lived signed proof so a fake service on another Wi-Fi cannot authorize attendance.

The expected flow is:

```text
phone discovers local gateway
        -> gateway produces short-lived proof
        -> phone submits attendance action + proof
        -> HRMS verifies employee, assignment, gateway/site and replay protection
        -> attendance event is recorded
```

## Current API usage

The current mobile app uses the existing HRMS endpoints rather than duplicating them:

- `POST /api/v1/auth/mobile/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/employee-self-service/profile`
- `GET /api/v1/employee-self-service/attendance-readiness/state`

Dedicated attendance-write endpoints will be added when check-in/check-out rules and office gateway proof are implemented.

## Current status

Real employee login, secure session persistence, profile loading, today's schedule/work-mode state, attendance state, and zero-config normal Expo development routing are implemented.

Check-in/check-out writes and the trusted office LAN gateway are the next implementation phase.
