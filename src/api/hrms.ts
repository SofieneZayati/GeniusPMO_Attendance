import type { MobileTodayResponse } from "../types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

function requireApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured.");
  }
  return API_BASE_URL;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${requireApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    throw new Error(`HRMS request failed (${response.status}).`);
  }

  return response.json() as Promise<T>;
}

// Planned mobile API boundary. The HRMS backend remains the source of truth.
export const hrmsApi = {
  today: (accessToken: string) =>
    request<MobileTodayResponse>("/mobile/today", {
      headers: { Authorization: `Bearer ${accessToken}` }
    }),
  checkIn: (accessToken: string) =>
    request<MobileTodayResponse>("/mobile/attendance/check-in", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` }
    }),
  checkOut: (accessToken: string) =>
    request<MobileTodayResponse>("/mobile/attendance/check-out", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` }
    })
};
