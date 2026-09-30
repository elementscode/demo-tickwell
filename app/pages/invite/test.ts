import { test, equal, assert, errorf, session, sql } from "@elements/app";
import { acceptInvite, findInvite } from "./template";

function pendingInvite(role: string = "member"): string {
  return sql<{ token: string }>(`
    insert into invites (email, role) values ('joiner@test.dev', ${role}) returning token
  `).firstOrThrow().token;
}

test("accepting an invite", async () => {
  test("creates the account with the invited role and signs in", () => {
    let token = pendingInvite("admin");
    equal(findInvite(token)?.email, "joiner@test.dev");

    acceptInvite(token, " Jo Iner ", "long-enough");

    let user = sql<{ id: string; name: string; role: string; ok: boolean }>(`
      select id, name, role, passwordHash = crypt('long-enough', passwordHash) as ok
        from users where email = 'joiner@test.dev'
    `).firstOrThrow();

    equal(user.name, "Jo Iner");
    equal(user.role, "admin");
    assert(user.ok, "password should verify");
    equal(session.get("userId"), user.id);
    equal(findInvite(token), undefined);
  });

  test("a link works once", async () => {
    let token = pendingInvite();
    acceptInvite(token, "Jo", "long-enough");

    try {
      await acceptInvite(token, "Jo again", "long-enough");
      errorf("expected ValidationError");
    } catch (err: any) {
      equal(err.name, "ValidationError");
    }
  });

  test("an expired link is refused", () => {
    let token = pendingInvite();
    sql(`update invites set expiresAt = now() - interval '1 minute' where token = ${token}`);

    equal(findInvite(token), undefined);
  });

  test("a short password is refused", async () => {
    let token = pendingInvite();

    try {
      await acceptInvite(token, "Jo", "short");
      errorf("expected ValidationError");
    } catch (err: any) {
      equal(err.name, "ValidationError");
    }
  });
});
