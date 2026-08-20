import Constants from "expo-constants";

const DEFAULT_DEV_API_PORT = "8000";
const API_PATH = "/api/v1";

export type ApiEndpointSource = "development-auto" | "configured";

export type ApiEndpoint = {
  baseUrl: string;
  source: ApiEndpointSource;
};

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function configuredBaseUrl() {
  const value = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  return value ? normalizeBaseUrl(value) : null;
}

function isDevelopmentLanHost(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (normalized === "localhost" || normalized === "127.0.0.1") return false;
  if (normalized.endsWith(".local")) return true;
  if (normalized.startsWith("10.")) return true;
  if (normalized.startsWith("192.168.")) return true;
  if (normalized.startsWith("169.254.")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")) {
    return true;
  }

  const parts = normalized.split(".").map(Number);
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part))) {
    return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
  }

  return false;
}

function developmentAutoBaseUrl() {
  if (!__DEV__) return null;

  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;

  try {
    const parsed = new URL(hostUri.includes("://") ? hostUri : `http://${hostUri}`);
    const hostname = parsed.hostname;
    if (!hostname || !isDevelopmentLanHost(hostname)) return null;

    const port = process.env.EXPO_PUBLIC_DEV_API_PORT?.trim() || DEFAULT_DEV_API_PORT;
    const host = hostname.includes(":") ? `[${hostname}]` : hostname;
    return `http://${host}:${port}${API_PATH}`;
  } catch {
    return null;
  }
}

export function resolveApiEndpoint(): ApiEndpoint {
  const autoDevelopmentUrl = developmentAutoBaseUrl();
  if (autoDevelopmentUrl) {
    return { baseUrl: autoDevelopmentUrl, source: "development-auto" };
  }

  const configuredUrl = configuredBaseUrl();
  if (configuredUrl) {
    return { baseUrl: configuredUrl, source: "configured" };
  }

  throw new Error(
    __DEV__
      ? "Could not discover the HRMS development server. Start Expo in LAN mode on the same network as the PC running the HRMS backend, or configure EXPO_PUBLIC_API_BASE_URL."
      : "EXPO_PUBLIC_API_BASE_URL must be configured for the production mobile build."
  );
}
