import type { Express, NextFunction, Request, Response } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { storage } from "./storage";
import { carsPublicOrigin } from "./evally/config";
import type { User } from "@shared/schema";

const PgSession = ConnectPgSimple(session);
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60;

declare module "express-session" {
  interface SessionData {
    userId?: string;
    oauthState?: string;
    oauthVerifier?: string;
  }
}

declare global {
  namespace Express {
    interface User {
      id: string;
      name: string;
      group: string;
      groupLabel: string;
      role: string;
      image?: string | null;
      phoneNumber?: string | null;
      telegramUsername?: string | null;
      telegramId?: string | null;
      isActive: boolean;
    }
    interface Request {
      user?: User;
    }
  }
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("SESSION_SECRET is required in production");
  }
  return secret || "dev-only-session-secret";
}

export function setupSession(app: Express): void {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS || 1);
  app.set("trust proxy", hops);

  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
        ttl: ONE_WEEK_SECONDS,
      }),
      name: "cars.sid",
      secret: sessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: ONE_WEEK_MS,
      },
    }),
  );

  app.use(async (req, res, next) => {
    try {
      if (!req.session.userId) {
        return next();
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || !user.isActive) {
        req.session.userId = undefined;
        return next();
      }
      req.user = toSessionUser(user);
      next();
    } catch (error) {
      next(error);
    }
  });

  app.use(rejectCrossSiteWrites);
}

function toSessionUser(user: User): Express.User {
  return {
    id: user.id,
    name: user.name,
    group: user.group,
    groupLabel: user.groupLabel ?? user.group,
    role: user.role,
    image: user.image,
    phoneNumber: user.phoneNumber,
    telegramUsername: user.telegramUsername,
    telegramId: user.telegramId,
    isActive: user.isActive,
  };
}

export function rejectCrossSiteWrites(req: Request, res: Response, next: NextFunction) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }

  if (req.path.startsWith("/api/auth/login") || req.path.startsWith("/api/auth/callback")) {
    return next();
  }

  const allowed = carsPublicOrigin();
  const origin = req.get("origin");
  if (origin) {
    if (origin.replace(/\/$/, "") !== allowed) {
      return res.status(403).json({ message: "Forbidden origin" });
    }
    return next();
  }

  const referer = req.get("referer");
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (refererOrigin !== allowed) {
        return res.status(403).json({ message: "Forbidden origin" });
      }
    } catch {
      return res.status(403).json({ message: "Forbidden origin" });
    }
  }

  next();
}

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.id) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
};

export function logout(req: Request, res: Response): void {
  req.session.destroy((error) => {
    if (error) {
      console.error("Session destroy error:", error);
      res.status(500).json({ message: "Logout failed" });
      return;
    }
    res.clearCookie("cars.sid");
    res.json({ success: true });
  });
}
