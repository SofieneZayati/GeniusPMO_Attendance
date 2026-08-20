# LeadX Attendance

LeadX Attendance is the employee attendance companion for the Genius PMO HRMS. Employees use their existing HRMS account, see the schedule and work mode selected by HRMS, and record check-in or check-out when the backend authorizes the action.

The app does not let employees select or change their work mode. It does not duplicate HR, payroll, administration, projects, or document features from the web platform.

## Attendance rules

- Office attendance is enabled only when the HRMS backend identifies the request as coming from a configured approved company network.
- Remote attendance works through the normal HTTPS API without company-LAN access.
- External-site attendance works through the normal HTTPS API without company-LAN access.
- Leave and non-working days remain blocked by HRMS business rules.

The buttons reflect server-authoritative readiness, and the check-in/check-out endpoints repeat the authorization. Changing the mobile UI cannot bypass the Office network rule.

## API connection

Production builds require a permanent public HTTPS endpoint:

```env
EXPO_PUBLIC_API_BASE_URL=https://REAL-COMPANY-API/api/v1
```

The same endpoint serves login, profile, protected profile photo, schedule, attendance readiness, and attendance writes. HRMS verifies the original client address against its configured Office CIDRs; the URL itself is never treated as Office proof.

Preview/internal builds may enable private-LAN discovery for local testing. Expo development can also derive the development PC address from Expo runtime configuration. Neither path embeds a laptop IP in source.

## Local development

```bash
npm ci
npm start
```

The normal Expo Go setup derives the development host and targets backend port `8000`. Set `EXPO_PUBLIC_DEV_API_PORT` only when a different port is needed. Use `EXPO_PUBLIC_API_BASE_URL` as an explicit fallback for a tunnel or separately hosted backend.

## Validation

```bash
npm run typecheck
npx expo-doctor
```

The tracked npm lockfile is required for deterministic local and EAS dependency installation.

## Android builds

Preview/internal APK:

```bash
eas build --platform android --profile preview
```

Production build:

```bash
eas build --platform android --profile production
```

The production EAS environment must provide the real `EXPO_PUBLIC_API_BASE_URL`. The build configuration rejects a missing, non-HTTPS, or incorrectly based production URL.
