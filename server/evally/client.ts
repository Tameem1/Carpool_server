import { directoryConfig, evallyBaseUrl, loginConfig } from "./config";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 2_000_000;

class EvallyHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EvallyHttpError";
  }
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) {
    throw new EvallyHttpError("Evally response too large", response.status);
  }

  const text = await response.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new EvallyHttpError("Evally response too large", response.status);
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new EvallyHttpError("Evally returned non-JSON", response.status);
  }
}

async function evallyFetch(
  path: string,
  init: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const baseUrl = evallyBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
    });
    const body = await readBoundedJson(response);
    return { status: response.status, body };
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") {
      throw new EvallyHttpError("Evally request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: unknown;
  token_type?: string;
};

let directoryToken: { value: string; expiresAt: number } | null = null;

export async function directoryAccessToken(): Promise<string> {
  if (directoryToken && directoryToken.expiresAt > Date.now() + 30_000) {
    return directoryToken.value;
  }

  const { directoryClientId, directoryClientSecret } = directoryConfig();
  const basic = Buffer.from(`${directoryClientId}:${directoryClientSecret}`).toString("base64");
  const { status, body } = await evallyFetch("/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "directory",
    }).toString(),
  });

  const token = body as TokenResponse;
  if (status !== 200 || typeof token.access_token !== "string") {
    directoryToken = null;
    throw new EvallyHttpError("Directory token request failed", status);
  }

  directoryToken = {
    value: token.access_token,
    expiresAt: Date.now() + Math.max(60, Number(token.expires_in ?? 1800)) * 1000,
  };
  return directoryToken.value;
}

export function clearDirectoryToken(): void {
  directoryToken = null;
}

export type DirectoryGroup = { name: string; label?: string | null; sort?: number | null };

export async function fetchDirectorySnapshot(): Promise<{
  generated_at?: string;
  groups?: DirectoryGroup[];
  students: Array<{
    sub: string;
    name: string;
    group: string;
    image?: string | null;
    idle?: boolean;
  }>;
}> {
  const token = await directoryAccessToken();
  let { status, body } = await evallyFetch("/api/sso/directory", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (status === 401) {
    clearDirectoryToken();
    const retryToken = await directoryAccessToken();
    ({ status, body } = await evallyFetch("/api/sso/directory", {
      headers: { Authorization: `Bearer ${retryToken}`, Accept: "application/json" },
    }));
  }

  if (status !== 200 || !body || typeof body !== "object") {
    throw new EvallyHttpError("Directory snapshot failed", status);
  }

  return body as {
    generated_at?: string;
    groups?: DirectoryGroup[];
    students: Array<{
      sub: string;
      name: string;
      group: string;
      image?: string | null;
      idle?: boolean;
    }>;
  };
}

export async function exchangeAuthorizationCode(code: string, verifier: string): Promise<string> {
  const { loginClientId, loginClientSecret, loginRedirectUri } = loginConfig();
  const basic = Buffer.from(`${loginClientId}:${loginClientSecret}`).toString("base64");
  const { status, body } = await evallyFetch("/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: loginRedirectUri,
      code_verifier: verifier,
    }).toString(),
  });

  const token = body as TokenResponse;
  if (typeof token.refresh_token !== "undefined") {
    // Login clients must not use refresh tokens. Drop without logging.
    delete token.refresh_token;
  }

  if (status !== 200 || typeof token.access_token !== "string") {
    throw new EvallyHttpError("Authorization code exchange failed", status);
  }

  return token.access_token;
}

export async function fetchSsoMe(accessToken: string): Promise<{
  sub: string;
  name: string;
  group: string;
  groupLabel: string;
  image?: string | null;
}> {
  const { status, body } = await evallyFetch("/api/sso/me", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  if (status !== 200 || !body || typeof body !== "object") {
    throw new EvallyHttpError("Identity lookup failed", status);
  }

  const me = body as {
    sub?: unknown;
    name?: unknown;
    group?: unknown;
    group_label?: unknown;
    image?: unknown;
  };
  if (
    typeof me.sub !== "string" ||
    me.sub === "" ||
    typeof me.name !== "string" ||
    me.name === "" ||
    typeof me.group !== "string" ||
    me.group === ""
  ) {
    throw new EvallyHttpError("Identity payload was incomplete", status);
  }

  return {
    sub: me.sub,
    name: me.name,
    group: me.group,
    // Older API builds do not send it; the latin key is always printable.
    groupLabel:
      typeof me.group_label === "string" && me.group_label !== ""
        ? me.group_label
        : me.group,
    image: typeof me.image === "string" ? me.image : null,
  };
}

export { EvallyHttpError };
