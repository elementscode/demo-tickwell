import { sql, session, AuthError, ForbiddenError } from "@elements/app";

export type Role = "member" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export const MIN_PASSWORD = 8;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

/** @rpc */
export function signin(email: string, password: string) {
  let address = normalizeEmail(email);

  if (!address || !password) {
    throw new AuthError("Enter your email and password.");
  }

  let user = sql<User>(`
    select id, email, name, role from users
     where email = ${address}
       and passwordHash = crypt(${password}, passwordHash)
  `).first();

  if (!user) {
    throw new AuthError("That email and password do not match.");
  }

  session.login({ userId: user.id, userName: user.name });
}

/** @rpc */
export function signout() {
  session.logout();
}

/**
 * The signed-in user, read fresh from the table on every call so a role
 * change or a removed account takes effect on the next request, not at the
 * next sign-in.
 */
export function currentUserOrThrow(): User {
  let userId = session.getOrThrow("userId");

  let user = sql<User>(`select id, email, name, role from users where id = ${userId}`).first();

  if (!user) {
    throw new AuthError("Sign in again.");
  }

  return user;
}

export function adminOrThrow(): User {
  let user = currentUserOrThrow();

  if (user.role !== "admin") {
    throw new ForbiddenError("Only an admin can do that.");
  }

  return user;
}

export function listMembers(): User[] {
  return sql<User>(`select id, email, name, role from users order by name`).all();
}
