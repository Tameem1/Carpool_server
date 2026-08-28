import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { isEvallyLoginEnabled, loginConfig } from "./config";
import {
  EvallyHttpError,
  exchangeAuthorizationCode,
  fetchSsoMe,
} from "./client";
import { storage } from "../storage";

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

function s256(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function oneString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export function registerEvallyLoginRoutes(app: Express): void {
  app.get("/api/auth/login", (req: Request, res: Response) => {
    if (!isEvallyLoginEnabled()) {
      return res.status(404).json({ message: "Evally login is not enabled" });
    }

    try {
      const { baseUrl, loginClientId, loginRedirectUri } = loginConfig();
      const state = base64Url(crypto.randomBytes(32));
      const verifier = base64Url(crypto.randomBytes(32));
      req.session.oauthState = state;
      req.session.oauthVerifier = verifier;

      req.session.save((error) => {
        if (error) {
          console.error("[SSO] failed to save login session");
          return res.status(500).json({ message: "Failed to start login" });
        }

        const params = new URLSearchParams({
          response_type: "code",
          client_id: loginClientId,
          redirect_uri: loginRedirectUri,
          scope: "identity",
          state,
          code_challenge: s256(verifier),
          code_challenge_method: "S256",
        });
        res.redirect(`${baseUrl}/oauth/authorize?${params.toString()}`);
      });
    } catch (error) {
      console.error("[SSO] login start failed", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Evally login is not configured" });
    }
  });

  app.get("/api/auth/callback", async (req: Request, res: Response) => {
    if (!isEvallyLoginEnabled()) {
      return res.status(404).json({ message: "Evally login is not enabled" });
    }

    const oauthError = oneString(req.query.error);
    if (oauthError) {
      return res.status(400).send("تعذّر تسجيل الدخول عبر إفالي. ارجع إلى التطبيق وحاول مرة أخرى.");
    }

    const code = oneString(req.query.code);
    const state = oneString(req.query.state);
    const expectedState = req.session.oauthState;
    const verifier = req.session.oauthVerifier;
    delete req.session.oauthState;
    delete req.session.oauthVerifier;

    if (!code || !state || !expectedState || !verifier || state !== expectedState) {
      return res.status(400).send("طلب تسجيل الدخول غير صالح.");
    }

    try {
      const accessToken = await exchangeAuthorizationCode(code, verifier);
      const me = await fetchSsoMe(accessToken);
      const user = await storage.upsertEvallyIdentity({
        id: me.sub,
        name: me.name,
        group: me.group,
        image: me.image ?? null,
      });

      if (!user.isActive) {
        return res.status(403).send("هذا الحساب موقوف.");
      }

      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      req.session.userId = user.id;
      await storage.touchLastLogin(user.id);

      await new Promise<void>((resolve, reject) => {
        req.session.save((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      res.redirect("/");
    } catch (error) {
      const status = error instanceof EvallyHttpError ? error.status : undefined;
      console.error("[SSO] callback failed", status ?? (error instanceof Error ? error.message : error));
      res.status(401).send("تعذّر إكمال تسجيل الدخول عبر إفالي.");
    }
  });
}
