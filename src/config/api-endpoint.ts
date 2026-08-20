import Constants from "expo-constants";
import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";

const DEFAULT_DEV_API_PORT = "8000";
const API_PATH = "/api/v1";
const EXPECTED_SERVICE = "Genius HRMS API";
const LAN_CACHE_KEY = "genius_hrms_lan_base_url";
const DISCOVERY_TIMEOUT_MS = 550;
const DISCOVERY_CONCURRENCY = 24;

export type ApiEndpointSource = "development-auto" | "configured" | "lan-discovery";

export type ApiEndpoint = {
  baseUrl: string;
  source: ApiEndpointSource;
};

let resolvedLanEndpoint: ApiEndpoint | null = null;
let lanDiscoveryPromise: Promise<ApiEndpoint> | null = null;

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function configuredBaseUrl() {
  const value = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  return value ? normalizeBaseUrl(value) : null;
}

function lanDiscoveryEnabled() {
  return process.env.EXPO_PUBLIC_ENABLE_LAN_DISCOVERY === "true";
}

function isDevelopmentLanHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (normalized === "localhost" || normalized === "127.0.0.1") return false;
  if (normalized.endsWith(".local")) return true;
  if (normalized.startsWith("10.")) return true;
  if (normalized.startsWith("192.168.")) return true;
  if (normalized.startsWith("169.254.")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")) {
    return true;
  }

  const secondOctet = /^172\.(\d+)\./.exec(normalized)?.[1];
  if (secondOctet) {
    const value = Number(secondOctet);
    return value >= 16 && value <= 31;
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
    const unwrappedHost = hostname.replace(/^\[|\]$/g, "");
    const host = unwrappedHost.includes(":") ? `[${unwrappedHost}]` : unwrappedHost;
    return `http://${host}:${port}${API_PATH}`;
  } catch {
    return null;
  }
}

function privateIpv4Prefix(ipAddress: string) {
  const octets = ipAddress.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return null;
  }

  const first = octets[0]!;
  const second = octets[1]!;
  const third = octets[2]!;
  const isPrivate =
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254);

  if (!isPrivate) return null;
  return `${first}.${second}.${third}`;
}

async function healthMatches(baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) return false;

    const body = (await response.json()) as { status?: unknown; service?: unknown };
    return body.status === "ok" && body.service === EXPECTED_SERVICE;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function persistLanEndpoint(endpoint: ApiEndpoint) {
  resolvedLanEndpoint = endpoint;
  try {
    await SecureStore.setItemAsync(LAN_CACHE_KEY, endpoint.baseUrl);
  } catch {
    // Memory cache is enough if secure storage is temporarily unavailable.
  }
}

async function tryCachedLanEndpoint(prefix: string) {
  const candidates: string[] = [];

  if (resolvedLanEndpoint?.source === "lan-discovery") {
    candidates.push(resolvedLanEndpoint.baseUrl);
  }

  try {
    const stored = await SecureStore.getItemAsync(LAN_CACHE_KEY);
    if (stored && !candidates.includes(stored)) candidates.push(stored);
  } catch {
    // Continue with normal discovery.
  }

  for (const baseUrl of candidates) {
    if (!baseUrl.startsWith(`http://${prefix}.`)) continue;
    if (await healthMatches(baseUrl)) {
      const endpoint: ApiEndpoint = { baseUrl, source: "lan-discovery" };
      resolvedLanEndpoint = endpoint;
      return endpoint;
    }
  }

  return null;
}

async function discoverLanEndpoint(): Promise<ApiEndpoint> {
  const ipAddress = await Network.getIpAddressAsync();
  const prefix = privateIpv4Prefix(ipAddress);
  if (!prefix) {
    throw new Error("HRMS LAN discovery requires the phone to be connected to a private local network.");
  }

  const cached = await tryCachedLanEndpoint(prefix);
  if (cached) return cached;

  const phoneHost = Number(ipAddress.split(".")[3]);
  const hosts = Array.from({ length: 254 }, (_, index) => index + 1).filter(
    (host) => host !== phoneHost
  );
  let cursor = 0;
  let found: ApiEndpoint | null = null;

  async function worker() {
    while (!found) {
      const host = hosts[cursor];
      cursor += 1;
      if (host === undefined) return;

      const baseUrl = `http://${prefix}.${host}:${DEFAULT_DEV_API_PORT}${API_PATH}`;
      if (await healthMatches(baseUrl)) {
        found = { baseUrl, source: "lan-discovery" };
        return;
      }
    }
  }

  await Promise.all(Array.from({ length: DISCOVERY_CONCURRENCY }, () => worker()));

  if (!found) {
    throw new Error("HRMS server not found on this network. Make sure the HRMS backend is running and reachable on port 8000.");
  }

  await persistLanEndpoint(found);
  return found;
}

export async function resolveApiEndpoint(): Promise<ApiEndpoint> {
  const autoDevelopmentUrl = developmentAutoBaseUrl();
  if (autoDevelopmentUrl) {
    return { baseUrl: autoDevelopmentUrl, source: "development-auto" };
  }

  const configuredUrl = configuredBaseUrl();
  if (configuredUrl) {
    return { baseUrl: configuredUrl, source: "configured" };
  }

  if (lanDiscoveryEnabled()) {
    if (!lanDiscoveryPromise) {
      lanDiscoveryPromise = discoverLanEndpoint().finally(() => {
        lanDiscoveryPromise = null;
      });
    }
    return lanDiscoveryPromise;
  }

  throw new Error(
    __DEV__
      ? "Could not discover the HRMS development server. Start Expo in LAN mode on the same network as the PC running the HRMS backend, or configure EXPO_PUBLIC_API_BASE_URL."
      : "No HRMS API endpoint is configured. Use a production API URL or enable LAN discovery for a preview build."
  );
}

export async function invalidateApiEndpoint() {
  resolvedLanEndpoint = null;
  try {
    await SecureStore.deleteItemAsync(LAN_CACHE_KEY);
  } catch {
    // A stale secure-store value will be validated before reuse.
  }
}
