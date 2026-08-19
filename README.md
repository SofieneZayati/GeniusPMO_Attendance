# Genius PMO Attendance

Lightweight mobile attendance companion for the Genius PMO HRMS.

## Scope

Employees sign in with their existing HRMS account, see their basic work profile and today's schedule/attendance status, and will record attendance according to the work mode already approved in HRMS.

The app intentionally does **not** duplicate HR, payroll, admin, projects, documents, or other web-HRMS features.

## Architecture

- Mobile client: this repository (Expo + React Native + TypeScript)
- Authentication/API: existing `GeniusPMO_HRMS` FastAPI service
- Database: existing HRMS PostgreSQL database
- Session storage: encrypted device storage through Expo SecureStore
- Office attendance proof: company-LAN verification will be added in the attendance-write phase

The mobile app never connects directly to PostgreSQL and never decides its own work mode. HRMS remains the source of truth.

## Current status

The mobile client now supports:

- real HRMS employee login through a bearer session token
- secure local session persistence
- automatic session restoration
- real employee profile data
- real company-date schedule/work-mode state
- real current attendance status
- sign out and manual refresh

Check-in/check-out submission is intentionally not enabled yet. The next phase will add remote/external attendance writes and company-LAN verification for office attendance.

## Local phone testing

1. Run the HRMS backend on the development PC.
2. Find the PC's LAN IPv4 address with `ipconfig` on Windows.
3. Copy `.env.example` to `.env` and replace `YOUR_PC_IP` with that IPv4 address.
4. Install dependencies and start Expo:

```bash
npm install
npm start
```

5. Open the project in Expo Go while the phone and PC are on the same Wi-Fi.

Example local API value:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.25:8000/api/v1
```

The HRMS backend must include the mobile authentication endpoint from its mobile-auth integration before real login can succeed.
