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

## API connection model

### Development

Local phone testing is zero-config in the normal setup. Expo exposes the development host address to the running app, so the mobile client derives the PC's LAN address automatically and connects to the HRMS backend on port `8000`.

This means moving between home, office, or another Wi-Fi network does not require editing the PC IP in `.env`, as long as:

- Expo and the HRMS backend are running on the same development PC
- the phone opens the project from that Expo development server
- the phone and PC can reach each other on the local network

If the backend uses another port, set `EXPO_PUBLIC_DEV_API_PORT`. If Expo is using tunnel mode or the backend runs on another machine, `EXPO_PUBLIC_API_BASE_URL` remains available as an explicit fallback.

### Production

Production does not use LAN discovery for the main HRMS API. The release build is configured once with a permanent HTTPS endpoint such as:

```env
EXPO_PUBLIC_API_BASE_URL=https://api.geniuspmo.com/api/v1
```

Employees then use the same app configuration from any network. Office LAN discovery/proof is a separate attendance-security mechanism and will only be required for office check-in/out.

## Current status

The mobile client supports:

- real HRMS employee login through a bearer session token
- secure local session persistence
- automatic session restoration
- real employee profile data
- real company-date schedule/work-mode state
- real current attendance status
- automatic local HRMS endpoint resolution during normal Expo development
- sign out and manual refresh

Check-in/check-out submission is intentionally not enabled yet. The next phase will add remote/external attendance writes and trusted company-LAN verification for office attendance.

## Local phone testing

1. Run the HRMS backend on the development PC.
2. In this repository, install dependencies and start Expo:

```bash
npm install
npm start
```

3. Open the project in Expo Go while the phone and PC are on the same Wi-Fi.
4. Sign in with a real HRMS employee account.

You normally do **not** need to run `ipconfig` or edit an IP address when moving between networks.

If local discovery cannot work because the network isolates devices, use an explicit API URL or test against the deployed HTTPS HRMS server instead.
