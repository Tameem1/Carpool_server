import { Express, Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import { verifyPassword, hashPassword } from "./auth-utils";

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      section: string;
      role: string;
      telegramUsername?: string | null;
      telegramId?: string | null;
    }
  }
}

export async function setupAuth(app: Express) {
  // Configure passport local strategy
  passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
  }, async (req: Request, username: string, password: string, done) => {
    try {
      const section = req.body.section;
      
      if (!section) {
        return done(null, false, { message: 'Section is required' });
      }

      const user = await storage.getUserByUsernameAndSection(username, section);
      
      if (!user) {
        return done(null, false, { message: 'Invalid credentials' });
      }

      const isValidPassword = await verifyPassword(password, user.password);
      
      if (!isValidPassword) {
        return done(null, false, { message: 'Invalid credentials' });
      }

      return done(null, {
        id: user.id,
        username: user.username,
        section: user.section,
        role: user.role,
        telegramUsername: user.telegramUsername,
        telegramId: user.telegramId
      });
    } catch (error) {
      return done(error);
    }
  }));

  // Serialize user for session
  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (user) {
        done(null, {
          id: user.id,
          username: user.username,
          section: user.section,
          role: user.role,
          telegramUsername: user.telegramUsername,
          telegramId: user.telegramId
        });
      } else {
        done(null, false);
      }
    } catch (error) {
      done(error);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());
}

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
};