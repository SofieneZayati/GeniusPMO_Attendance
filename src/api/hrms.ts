import type {
  AttendanceReadinessResponse,
  CurrentUser,
  MobileLoginResponse,
  MobileTodayResponse,
  SelfServiceProfileResponse
} from "../types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

export class HrmsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "HrmsApiError";
  }
}

function requireApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured.");
  }
  return API_BASE_URL;
}

async function request<T>(path: string, init?: RequestInit, accessToken?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${requireApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...init?.headers
    }
  });

  if (!response.ok) {
    let message = `HRMS request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) message = body.detail;
    } catch {
      // Keep the status-based fallback when the response is not JSON.
    }
    throw new HrmsApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

function mapToday(
  profile: SelfServiceProfileResponse,
  attendance: AttendanceReadinessResponse
): MobileTodayResponse {
  const state = attendance.entry_time
    ? attendance.exit_time
      ? "completed"
      : "working"
    : "notCheckedIn";

  return {
    employee: {
      id: profile.id,
      employeeNo: profile.employee_no,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      position: profile.job_title,
      department: profile.department,
      team: profile.primary_team,
      manager: profile.manager,
      contractType: profile.contract_type,
      startDate: profile.start_date
    },
    attendance: {
      date: attendance.work_date,
      start: attendance.schedule_start ?? "--:--",
      end: attendance.schedule_end ?? "--:--",
      workMode: attendance.work_mode,
      state,
      status: attendance.status,
      checkIn: attendance.entry_time ?? undefined,
      checkOut: attendance.exit_time ?? undefined,
      officeNetworkVerified: false,
      canCheckIn: false,
      canCheckOut: false
    }
  };
}

export const hrmsApi = {
  login: (email: string, password: string) =>
    request<MobileLoginResponse>("/auth/mobile/login", {
      method: "POST",
      body: JSON.stringify({ email, password, remember_me: true })
    }),

  me: (accessToken: string) => request<CurrentUser>("/auth/me", undefined, accessToken),

  today: async (accessToken: string) => {
    const [profile, attendance] = await Promise.all([
      request<SelfServiceProfileResponse>(
        "/employee-self-service/profile",
        undefined,
        accessToken
      ),
      request<AttendanceReadinessResponse>(
        "/employee-self-service/attendance-readiness/state",
        undefined,
        accessToken
      )
    ]);

    return mapToday(profile, attendance);
  }
};
