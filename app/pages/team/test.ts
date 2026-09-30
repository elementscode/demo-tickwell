import { test, equal, assert, errorf, session, sql } from "@elements/app";
import { invite, listInvites, revokeInvite } from "./services";

// The email is unique per call: test files run in parallel against one
// database, and two open transactions inserting the same email block each other.
function uniqueEmail(name: string): string {
  return `${name}-${crypto.randomUUID().slice(0, 8)}@test.dev`;
}

function admin(): { id: string; email: string } {
  let row = sql<{ id: string; email: string }>(`
    insert into users (email, name, role, passwordHash) values (${uniqueEmail("ada")}, 'Ada Admin', 'admin', 'x') returning id, email
  `).firstOrThrow();

  session.login({ userId: row.id, userName: "Ada Admin" });

  return row;
}

test("team invites", async () => {
  test("an admin invites by email and a job sends the link", () => {
    admin();
    let before = listInvites().length;

    let pending = invite("  New.Person@Test.dev ", "member");

    equal(pending.length, before + 1);
    let added = pending.find((p) => p.email === "new.person@test.dev");
    assert(added !== undefined, "expected the new invite in the pending list");
    equal(added!.invitedByName, "Ada Admin");

    let jobs = sql<{ n: number }>(`
      select count(*)::int as n from elements.jobs where path = 'app/jobs/send-invite:SendInviteJob' and state = 'pending'
    `).firstOrThrow();
    assert(jobs.n >= 1, "expected a SendInviteJob");
  });

  test("inviting the same address again replaces the old link", () => {
    admin();

    invite("again@test.dev", "member");
    let first = sql<{ token: string }>(`select token from invites where email = 'again@test.dev'`).firstOrThrow();
    invite("again@test.dev", "admin");

    let rows = sql<{ token: string; role: string }>(`select token, role from invites where email = 'again@test.dev'`).all();
    equal(rows.length, 1);
    equal(rows[0].role, "admin");
    assert(rows[0].token !== first.token, "expected a fresh token");
  });

  test("revoking removes the pending invite", () => {
    admin();
    let before = listInvites().length;

    let pending = invite("gone@test.dev", "member").find((p) => p.email === "gone@test.dev")!;
    let after = revokeInvite(pending.id);

    equal(after.length, before);
    assert(after.every((p) => p.id !== pending.id), "expected the revoked invite to be gone");
  });

  test("members cannot invite", async () => {
    let row = sql<{ id: string }>(`
      insert into users (email, name, role, passwordHash) values (${uniqueEmail("ben")}, 'Ben', 'member', 'x') returning id
    `).firstOrThrow();
    session.login({ userId: row.id, userName: "Ben" });

    try {
      await invite("x@test.dev", "member");
      errorf("expected ForbiddenError");
    } catch (err: any) {
      equal(err.name, "ForbiddenError");
    }
  });

  test("an address already on the team is refused", async () => {
    let ada = admin();

    try {
      await invite(ada.email, "member");
      errorf("expected ValidationError");
    } catch (err: any) {
      equal(err.name, "ValidationError");
    }
  });
});
