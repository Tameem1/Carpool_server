function optional(name: string): string {
  return (process.env[name] ?? "").trim();
}

function required(name: string): string {
  const value = optional(name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function bool(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true" || value === "1";
}

export function evallyAdminIds(): string[] {
  return optional("CARS_ADMIN_EVALLY_IDS")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function carsPublicOrigin(): string {
  return (optional("CARS_PUBLIC_ORIGIN") || "http://localhost:3000").replace(/\/$/, "");
}

export function isDirectorySyncEnabled(): boolean {
  return bool("CARS_DIRECTORY_SYNC_ENABLED");
}

export function isEvallyLoginEnabled(): boolean {
  return bool("CARS_EVALLY_LOGIN_ENABLED");
}

export function evallyBaseUrl(): string {
  return (optional("EVALLY_BASE_URL") || "https://api.evally.net").replace(/\/$/, "");
}

export function loginConfig() {
  return {
    baseUrl: evallyBaseUrl(),
    loginClientId: required("EVALLY_LOGIN_CLIENT_ID"),
    loginClientSecret: required("EVALLY_LOGIN_CLIENT_SECRET"),
    loginRedirectUri: required("EVALLY_LOGIN_REDIRECT_URI"),
    publicOrigin: carsPublicOrigin(),
  };
}

export function directoryConfig() {
  return {
    baseUrl: evallyBaseUrl(),
    directoryClientId: required("EVALLY_DIRECTORY_CLIENT_ID"),
    directoryClientSecret: required("EVALLY_DIRECTORY_CLIENT_SECRET"),
    syncIntervalMinutes: Number(process.env.DIRECTORY_SYNC_INTERVAL_MINUTES || 15),
  };
}

export function evallyConfig() {
  return {
    ...loginConfig(),
    ...directoryConfig(),
    directorySyncEnabled: isDirectorySyncEnabled(),
    loginEnabled: isEvallyLoginEnabled(),
  };
}
