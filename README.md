# Genius PMO Attendance

Lightweight mobile attendance companion for the Genius PMO HRMS.

## Scope

The app is intentionally small. Employees sign in with their existing HRMS account, see basic work-profile details and today's schedule, then check in or out according to the work assignment already approved in HRMS.

It does **not** contain HR, payroll, admin, project-management, documents, or other web-HRMS features.

## Architecture

- Mobile client: this repository (Expo + React Native + TypeScript)
- Backend/API: existing `GeniusPMO_HRMS` FastAPI service
- Database: existing HRMS PostgreSQL database
- Office attendance proof: future office-only LAN gateway

See `docs/ARCHITECTURE.md` for the rules.

## Initial prototype

The current starter includes:

- sign-in screen shell
- Today screen with schedule/work mode
- Check In / Check Out interaction prototype
- Profile screen with basic employee details
- typed HRMS API client boundary
- environment variable for the public HRMS API

The displayed employee data and button state are temporary UI demo data. They will be removed when mobile endpoints are implemented in the HRMS backend.

## Run locally

Copy the environment file:

```bash
cp .env.example .env
```

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npm start
```

During the current Expo SDK transition, the project targets SDK 54 so it can be tested conveniently with Expo Go on physical phones.

## Security rules

- The app never connects directly to PostgreSQL.
- The backend decides today's work mode and whether attendance is allowed.
- Office attendance must be proven through the private office LAN path.
- Remote/external attendance is only accepted when HRMS says the employee is assigned to that mode for the day.
- No phone biometric hardware is required.
