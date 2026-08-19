# Genius PMO Attendance — initial architecture

## Purpose

This is a small employee attendance companion, not a mobile copy of the HRMS.

The mobile app will expose only:

- HRMS employee sign-in
- basic work profile
- today's approved work mode and schedule
- attendance status
- check-in and check-out

## Source of truth

The existing `GeniusPMO_HRMS` FastAPI backend and PostgreSQL database remain the only source of truth. This repository must not introduce a second employee database or an independent attendance backend.

## Attendance authorization

The mobile app never decides whether an employee is remote, external, or office-based. It asks the HRMS backend for today's approved assignment.

- **Office:** check-in/out requires proof through an office-only LAN attendance gateway.
- **Remote:** check-in/out is accepted by the public HRMS API only when today's approved assignment is remote.
- **External site:** check-in/out is accepted by the public HRMS API only when today's approved assignment is external.
- **Leave / not scheduled:** attendance actions are rejected.

No Face ID, fingerprint, or phone biometric capability is required.

## Planned request flow

```text
Mobile app
   |
   | HTTPS authenticated employee session/token
   v
Genius PMO HRMS FastAPI
   |
   +--> today's schedule/work assignment
   +--> employee profile projection
   +--> attendance rules
   |
   v
Existing PostgreSQL attendance records
```

Office attendance adds the local proof path:

```text
Mobile app -> office LAN gateway -> HRMS FastAPI -> PostgreSQL
```

The public HRMS backend must reject direct office check-in attempts that do not contain trusted gateway proof.

## Proposed API surface

The exact authentication mechanism will be finalized in the HRMS backend before wiring the client. Planned endpoints:

- `GET /api/v1/mobile/today`
- `POST /api/v1/mobile/attendance/check-in`
- `POST /api/v1/mobile/attendance/check-out`

`GET /mobile/today` should return only the minimum mobile projection: basic employee profile, today's schedule/work mode, attendance state, and allowed actions.

## Current status

The repository starts with a UI prototype and a typed API client boundary. Check-in/out actions are local prototype state only until the HRMS mobile endpoints and office gateway are implemented.
