import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";
import createMemoryStore from "memorystore";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, hashed: string): Promise<boolean> {
  const [hashedPassword, salt] = hashed.split(".");
  if (!hashedPassword || !salt) return false;
  const hashedSuppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(Buffer.from(hashedPassword, "hex"), hashedSuppliedBuf);
}

export function setupAuth(app: Express) {
  // Session configuration
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "absensi-rfid-finger-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: app.get("env") === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  if (app.get("env") === "production" && process.env.DATABASE_URL) {
    app.set("trust proxy", 1);
  }

  // Use memorystore to prevent memory leaks in production
  const MemoryStore = createMemoryStore(session);
  sessionSettings.store = new MemoryStore({
    checkPeriod: 86400000, // prune expired entries every 24h
  });

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Username atau password salah" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Authentication API Endpoints
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Login gagal" });
      }
      req.login(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        
        let employeeProfile = null;
        if (user.role === "employee" && user.employeeId) {
          employeeProfile = await storage.getEmployee(user.employeeId);
        }
        
        return res.json({
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            employeeId: user.employeeId,
          },
          employee: employeeProfile
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: "Logout berhasil" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Belum login" });
    }
    const user = req.user as User;
    
    let employeeProfile = null;
    if (user.role === "employee" && user.employeeId) {
      employeeProfile = await storage.getEmployee(user.employeeId);
    }
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        employeeId: user.employeeId,
      },
      employee: employeeProfile
    });
  });
}

// Seed helper for default admin
export async function seedAdmin() {
  try {
    const existingAdmin = await storage.getUserByUsername("admin");
    if (!existingAdmin) {
      const hashedPassword = await hashPassword("admin123");
      await storage.createUser({
        username: "admin",
        password: hashedPassword,
        role: "admin",
        employeeId: null,
      });
      console.log("✓ Default admin account created (username: admin, password: admin123)");
    }
  } catch (err) {
    console.error("❌ Failed to seed default admin:", err);
  }
}
