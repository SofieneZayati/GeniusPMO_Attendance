import { resolveApiEndpoint } from "../config/api-endpoint";
import type {
  AttendanceReadinessResponse,
  AttendanceSimulatorScanResponse,
  CurrentUser,
  MobileLoginResponse,
  MobileTodayResponse,
  SelfServiceProfileResponse,
  WorkMode
} from "../types";

type AttendanceAction = "check_in" | "check_out";

type CachedProfilePhoto = {
  accessToken: string;
  dataUri: string;
};

let cachedProfilePhoto: CachedProfilePhoto | null = null;

export class HrmsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "HrmsApiError";
  }
}

function responseErrorMessage(status: number, rawBody: string) {
  const fallback = `HRMS request failed (${status}).`;
  if (!rawBody.trim()) return fallback;

  try {
    const body = JSON.parse(rawBody) as {
      detail?: unknown;
      error?: { message?: unknown };
    };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
    if (typeof body.error?.message === "string" && body.error.message.trim()) {
      return body.error.message;
    }
  } catch {
    if (status < 500) {
      const text = rawBody.trim();
      if (text.length <= 200) return text;
    }
  }

  return fallback;
}

async function request<T>(path: string, init?: RequestInit, accessToken?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const { baseUrl } = resolveApiEndpoint();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...init?.headers
    }
  });

  if (!response.ok) {
    const rawBody = await response.text();
    throw new HrmsApiError(responseErrorMessage(response.status, rawBody), response.status);
  }

  return response.json() as Promise<T>;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The protected profile photo could not be read."));
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("The protected profile photo could not be decoded."));
      }
    };
    reader.readAsDataURL(blob);
  });
}

async function protectedImageDataUri(path: string, accessToken: string): Promise<string> {
  const { baseUrl } = resolveApiEndpoint();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: "image/*",
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const rawBody = await response.text();
    throw new HrmsApiError(responseErrorMessage(response.status, rawBody), response.status);
  }

  return blobToDataUri(await response.blob());
}

async function cacheProfilePhoto(
  profile: SelfServiceProfileResponse,
  accessToken: string
): Promise<boolean> {
  if (!profile.has_profile_photo) {
    if (cachedProfilePhoto?.accessToken === accessToken) cachedProfilePhoto = null;
    return false;
  }

  if (cachedProfilePhoto?.accessToken === accessToken) return true;

  try {
    cachedProfilePhoto = {
      accessToken,
      dataUri: await protectedImageDataUri(
        "/employee-self-service/profile-photo",
        accessToken
      )
    };
    return true;
  } catch {
    if (cachedProfilePhoto?.accessToken === accessToken) cachedProfilePhoto = null;
    return false;
  }
}

function mapToday(
  profile: SelfServiceProfileResponse,
  attendance: AttendanceReadinessResponse,
  protectedPhotoLoaded: boolean
): MobileTodayResponse {
  const state = attendance.entry_time
    ? attendance.exit_time
      ? "completed"
      : "working"
    : "notCheckedIn";
  const directMobileMode =
    attendance.work_mode === "remote" || attendance.work_mode === "externalSite";
  const developmentOfficeAction =
    attendance.work_mode === "office" && attendance.can_simulate_scan;
  const canAct = directMobileMode || developmentOfficeAction;

  return {
    employee: {
      id: profile.id,
      employeeNo: profile.employee_no,
      name: profile.name,
      hasProfilePhoto: profile.has_profile_photo && protectedPhotoLoaded,
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
      canCheckIn: state === "notCheckedIn" && canAct,
      canCheckOut: state === "working" && canAct,
      developmentOfficeAction
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

  profilePhotoSource: (accessToken: string) => ({
    uri: cachedProfilePhoto?.accessToken === accessToken ? cachedProfilePhoto.dataUri : ""
  }),

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

    const protectedPhotoLoaded = await cacheProfilePhoto(profile, accessToken);
    return mapToday(profile, attendance, protectedPhotoLoaded);
  },

  recordAttendance: async (
    accessToken: string,
    action: AttendanceAction,
    workMode: WorkMode
  ) => {
    if (workMode === "office") {
      return request<AttendanceSimulatorScanResponse>(
        "/employee-self-service/attendance-readiness/simulator/scan",
        {
          method: "POST",
          body: JSON.stringify({})
        },
        accessToken
      );
    }

    const endpoint = action === "check_in" ? "check-in" : "check-out";
    return request<AttendanceReadinessResponse>(
      `/mobile/attendance/${endpoint}`,
      { method: "POST" },
      accessToken
    );
  }
};
