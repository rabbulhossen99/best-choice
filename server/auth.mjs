import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { hash } from "./commerce.mjs";
const scrypt = promisify(scryptCallback);
export async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${Buffer.from(await scrypt(password, salt, 64)).toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored)) {
    await scrypt(password, "disabled-account", 64);
    return false;
  }
  const [salt, key] = stored.split(":");
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(Buffer.from(key, "hex"), actual);
}
export const safeUser = (user) =>
  user
    ? { id: user.id, name: user.name, email: user.email, role: user.role }
    : null;
export function sessions(db, production = false) {
  return (req, res, next) => {
    const cookie = (req.headers.cookie || "")
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("gh_session="))
      ?.slice(11);
    let session =
      cookie && /^[a-f0-9]{64}$/.test(cookie)
        ? db
            .prepare("SELECT * FROM sessions WHERE id=? AND expires>?")
            .get(hash(cookie), Date.now())
        : null;
    if (!session) {
      // Storefront tracking configuration is intentionally public: it contains
      // only the Pixel's public settings. Keep every other API route behind a
      // session so CSRF and admin authorization remain unchanged.
      if (
        req.path !== "/session" &&
        !(req.method === "GET" && req.path === "/tracking/config")
      )
        return res
          .status(401)
          .json({ error: "Session expired. Refresh the page." });
      if (req.method === "GET" && req.path === "/tracking/config") {
        req.session = {
          id: null,
          user_id: null,
          csrf: null,
          expires: 0,
        };
        req.user = null;
        return next();
      }
      const raw = randomBytes(32).toString("hex");
      session = {
        id: hash(raw),
        user_id: null,
        csrf: randomBytes(32).toString("hex"),
        expires: Date.now() + 30 * 86400000,
      };
      db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
        session.id,
        null,
        session.csrf,
        session.expires,
      );
      res.cookie("gh_session", raw, {
        httpOnly: true,
        sameSite: "strict",
        secure: production,
        maxAge: 30 * 86400000,
        path: "/",
      });
    }
    req.session = session;
    req.user = session.user_id
      ? db.prepare("SELECT * FROM users WHERE id=?").get(session.user_id)
      : null;
    next();
  };
}
export function rotateSession(db, req, res, user, production) {
  const raw = randomBytes(32).toString("hex"),
    next = hash(raw),
    csrf = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
    next,
    user?.id || null,
    csrf,
    Date.now() + 30 * 86400000,
  );
  db.prepare("UPDATE carts SET session_id=? WHERE session_id=?").run(
    next,
    req.session.id,
  );
  db.prepare("UPDATE checkouts SET session_id=? WHERE session_id=?").run(
    next,
    req.session.id,
  );
  db.prepare(
    "UPDATE orders SET session_id=?,user_id=COALESCE(user_id,?) WHERE session_id=?",
  ).run(next, user?.id || null, req.session.id);
  db.prepare("DELETE FROM sessions WHERE id=?").run(req.session.id);
  res.cookie("gh_session", raw, {
    httpOnly: true,
    sameSite: "strict",
    secure: production,
    maxAge: 30 * 86400000,
    path: "/",
  });
  return { user: safeUser(user), csrf };
}
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin")
    return res.status(403).json({ error: "Administrator access required." });
  next();
};
export const requireUser = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Sign in required." });
  next();
};
