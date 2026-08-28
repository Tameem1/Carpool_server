import express from "express";
import request from "supertest";
import session from "express-session";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exchangeAuthorizationCode = vi.fn();
const fetchSsoMe = vi.fn();
const upsertEvallyIdentity = vi.fn();
const touchLastLogin = vi.fn();

vi.mock("./client", () => ({
  exchangeAuthorizationCode,
  fetchSsoMe,
  EvallyHttpError: class EvallyHttpError extends Error {
    constructor(message: string, readonly status?: number) {
      super(message);
    }
  },
}));

vi.mock("../storage", () => ({
  storage: {
    upsertEvallyIdentity,
    touchLastLogin,
    getUser: vi.fn(),
  },
}));

function appWithLogin() {
  const app = express();
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  return app;
}

describe("evally login", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CARS_EVALLY_LOGIN_ENABLED = "true";
    process.env.EVALLY_LOGIN_CLIENT_ID = "login-id";
    process.env.EVALLY_LOGIN_CLIENT_SECRET = "login-secret";
    process.env.EVALLY_LOGIN_REDIRECT_URI = "http://localhost:3000/api/auth/callback";
  });

  afterEach(() => {
    delete process.env.CARS_EVALLY_LOGIN_ENABLED;
    vi.clearAllMocks();
  });

  it("keeps login routes unavailable while the flag is off", async () => {
    process.env.CARS_EVALLY_LOGIN_ENABLED = "false";
    const { registerEvallyLoginRoutes } = await import("./login");
    const app = appWithLogin();
    registerEvallyLoginRoutes(app);
    const res = await request(app).get("/api/auth/login");
    expect(res.status).toBe(404);
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it("rejects a missing or mismatched state before any token exchange", async () => {
    const { registerEvallyLoginRoutes } = await import("./login");
    const app = appWithLogin();
    registerEvallyLoginRoutes(app);
    const res = await request(app).get("/api/auth/callback?code=abc&state=wrong");
    expect(res.status).toBe(400);
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it("does not reflect OAuth error text", async () => {
    const { registerEvallyLoginRoutes } = await import("./login");
    const app = appWithLogin();
    registerEvallyLoginRoutes(app);
    const res = await request(app).get("/api/auth/callback?error=<script>alert(1)</script>");
    expect(res.status).toBe(400);
    expect(res.text).not.toContain("<script>");
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
  });
});
