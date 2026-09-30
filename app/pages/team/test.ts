import { test, equal, assert, errorf, session, sql } from "@elements/app";
import { invite, revokeInvite } from "./services";

function admin(): string {
  let row = sql<{ id: string }>(`
    insert into users (email, name, role, passwordHash) values ('ada@test.dev', 'Ada Admin', 'admin', 'x') returning id
  `).firstOrThrow();

  session.login({ userId: row.id, userName: "Ada Admin" });

  return row.id;
}

test("team invites", async () => {
  test("an admin invites by email and a job sends the link", () => {
    admin();

    let pending = invite("  New.Person@Test.dev ", "member");

    equal(pending.length, 1);
    equal(pending[0].email, "new.person@test.dev");
    equal(pending[0].invitedByName, "Ada Admin");

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

    let [pending] = invite("gone@test.dev", "member");
    equal(revokeInvite(pending.id).length, 0);
  });

  test("members cannot invite", async () => {
    let row = sql<{ id: string }>(`
      insert into users (email, name, role, passwordHash) values ('ben@test.dev', 'Ben', 'member', 'x') returning id
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
    admin();

    try {
      await invite("ada@test.dev", "member");
      errorf("expected ValidationError");
    } catch (err: any) {
      equal(err.name, "ValidationError");
    }
  });
});
