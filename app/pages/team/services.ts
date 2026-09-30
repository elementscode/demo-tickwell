import { sql, tx, ValidationError } from "@elements/app";
import { Role, adminOrThrow, currentUserOrThrow, isEmail, normalizeEmail } from "#app/shared/services/auth";
import { SendInviteJob } from "#app/jobs/send-invite";

export interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  invitedByName: string | null;
  createdAt: Date;
  expiresAt: Date;
}

export function listInvites(): PendingInvite[] {
  return sql<PendingInvite>(`
    select i.id, i.email, i.role, u.name as invitedByName, i.createdAt, i.expiresAt
      from invites i
      left join users u on u.id = i.invitedById
     where i.acceptedAt is null
       and i.expiresAt > now()
     order by i.createdAt desc
  `).all();
}

/**
 * Inviting an address that already has a pending invite replaces it, so the
 * newest link is the only one that works.
 * @rpc
 */
export function invite(email: string, role: Role): PendingInvite[] {
  let admin = adminOrThrow();
  let address = normalizeEmail(email);

  if (!isEmail(address)) {
    throw new ValidationError("Enter a valid email address.");
  }

  if (role !== "member" && role !== "admin") {
    throw new ValidationError("Pick a role.");
  }

  if (!sql(`select 1 from users where email = ${address}`).empty()) {
    throw new ValidationError(`${address} is already on the team.`);
  }

  tx(() => {
    sql(`delete from invites where email = ${address} and acceptedAt is null`);

    let row = sql<{ id: string }>(`
      insert into invites (email, role, invitedById)
           values (${address}, ${role}, ${admin.id})
      returning id
    `).firstOrThrow();

    new SendInviteJob({ inviteId: row.id }).schedule();
  });

  return listInvites();
}

/** @rpc */
export function revokeInvite(inviteId: string): PendingInvite[] {
  adminOrThrow();

  sql(`delete from invites where id = ${inviteId} and acceptedAt is null`);

  return listInvites();
}

/** @rpc */
export function resendInvite(inviteId: string): PendingInvite[] {
  adminOrThrow();

  let row = sql<{ id: string }>(`
    update invites
       set expiresAt = now() + interval '7 days'
     where id = ${inviteId}
       and acceptedAt is null
    returning id
  `).first();

  if (row) {
    new SendInviteJob({ inviteId: row.id }).schedule();
  }

  return listInvites();
}

/** @rpc */
export function refreshInvites(): PendingInvite[] {
  currentUserOrThrow();

  return listInvites();
}
