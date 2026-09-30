import { test, equal, assert, errorf, session, sql } from "@elements/app";
import { issues, comments, issueEvents, Issue } from "#app/shared/services/tracker";

interface Fixture {
  adminId: string;
  memberId: string;
  otherId: string;
  projectId: string;
}

function fixture(): Fixture {
  let users = sql<{ id: string; email: string }>(`
    insert into users (email, name, role, passwordHash) values
      ('ada@test.dev',   'Ada Admin',   'admin',  'x'),
      ('ben@test.dev',   'Ben Member',  'member', 'x'),
      ('cleo@test.dev',  'Cleo Member', 'member', 'x')
    returning id, email
  `).all();

  let project = sql<{ id: string }>(`insert into projects (key, name) values ('TST', 'Test') returning id`).firstOrThrow();
  let byEmail = (email: string) => users.find((u) => u.email === email)!.id;

  return { adminId: byEmail("ada@test.dev"), memberId: byEmail("ben@test.dev"), otherId: byEmail("cleo@test.dev"), projectId: project.id };
}

function jobCount(path: string): number {
  return sql<{ n: number }>(`select count(*)::int as n from elements.jobs where path = ${path} and state = 'pending'`).firstOrThrow().n;
}

async function expectError(fn: () => unknown, name: string) {
  try {
    await fn();
    errorf("expected %v", name);
  } catch (err: any) {
    equal(err.name, name, err.message);
  }
}

test("issues", async () => {
  test("numbers issues per project in order", async () => {
    let f = fixture();
    session.login({ userId: f.memberId, userName: "Ben Member" });

    let view = issues.view({ projectId: f.projectId });
    let first = view.insert({ title: "First" });
    let second = view.insert({ title: "Second" });

    equal(first.number, 1);
    equal(second.number, 2);
    equal(first.reporterId, f.memberId);
    equal(first.status, "backlog");
  });

  test("records a history row per changed field", async () => {
    let f = fixture();
    session.login({ userId: f.memberId, userName: "Ben Member" });

    let view = issues.view({ projectId: f.projectId });
    let issue = view.insert({ title: "Board move", status: "todo" });
    view.update({ ...issue, status: "in_progress", assigneeId: f.otherId, labels: ["Bug", "bug", " UI "] });

    let events = sql<{ field: string; fromValue: string | null; toValue: string | null }>(`
      select field, fromValue, toValue from issueEvents where issueId = ${issue.id} order by createdAt, field
    `).all();

    equal(events.map((e) => e.field).sort(), ["assignee", "created", "labels", "status"]);
    equal(events.find((e) => e.field === "status")?.toValue, "in_progress");
    equal(events.find((e) => e.field === "assignee")?.toValue, "Cleo Member");

    let stored = sql<Issue>(`select * from issues where id = ${issue.id}`).firstOrThrow();
    equal(stored.labels, ["bug", "ui"]);
  });

  test("emails the new assignee, but not someone assigning themselves", async () => {
    let f = fixture();
    session.login({ userId: f.memberId, userName: "Ben Member" });

    let view = issues.view({ projectId: f.projectId });
    let before = jobCount("app/jobs/issue-assigned:IssueAssignedJob");

    let mine = view.insert({ title: "Mine", assigneeId: f.memberId });
    equal(jobCount("app/jobs/issue-assigned:IssueAssignedJob"), before);

    view.update({ ...mine, assigneeId: f.otherId });
    equal(jobCount("app/jobs/issue-assigned:IssueAssignedJob"), before + 1);

    view.insert({ title: "Theirs", assigneeId: f.otherId });
    equal(jobCount("app/jobs/issue-assigned:IssueAssignedJob"), before + 2);
  });

  test("rejects an unknown status", async () => {
    let f = fixture();
    session.login({ userId: f.memberId, userName: "Ben Member" });

    await expectError(() => {
      issues.view({ projectId: f.projectId }).insert({ title: "Bad", status: "shipped" as any });
    }, "ValidationError");
  });

  test("only an admin can delete an issue", async () => {
    let f = fixture();
    session.login({ userId: f.memberId, userName: "Ben Member" });

    let issue = issues.view({ projectId: f.projectId }).insert({ title: "Keep me" });
    await expectError(() => issues.view({ projectId: f.projectId }).delete(issue), "ForbiddenError");

    session.login({ userId: f.adminId, userName: "Ada Admin" });
    issues.view({ projectId: f.projectId }).delete(issue);
    assert(sql(`select 1 from issues where id = ${issue.id}`).empty(), "issue should be gone");
  });

  test("requires a signed-in user", async () => {
    let f = fixture();

    await expectError(() => issues.view({ projectId: f.projectId }).insert({ title: "Anon" }), "AuthError");
  });
});

test("comments", async () => {
  test("email the assignee when someone else comments", async () => {
    let f = fixture();
    session.login({ userId: f.memberId, userName: "Ben Member" });

    let issue = issues.view({ projectId: f.projectId }).insert({ title: "Discuss", assigneeId: f.otherId });
    let thread = comments.view({ issueId: issue.id });
    let before = jobCount("app/jobs/issue-commented:IssueCommentedJob");

    let comment = thread.insert({ body: "  Looks good  " });
    equal(comment.body, "Looks good");
    equal(comment.authorName, "Ben Member");
    equal(jobCount("app/jobs/issue-commented:IssueCommentedJob"), before + 1);

    session.login({ userId: f.otherId, userName: "Cleo Member" });
    comments.view({ issueId: issue.id }).insert({ body: "Thanks" });
    equal(jobCount("app/jobs/issue-commented:IssueCommentedJob"), before + 1);
  });

  test("only the author or an admin deletes a comment", async () => {
    let f = fixture();
    session.login({ userId: f.memberId, userName: "Ben Member" });

    let issue = issues.view({ projectId: f.projectId }).insert({ title: "Thread" });
    let comment = comments.view({ issueId: issue.id }).insert({ body: "Mine" });

    session.login({ userId: f.otherId, userName: "Cleo Member" });
    await expectError(() => comments.view({ issueId: issue.id }).delete(comment), "ForbiddenError");

    session.login({ userId: f.adminId, userName: "Ada Admin" });
    comments.view({ issueId: issue.id }).delete(comment);
    assert(sql(`select 1 from comments where id = ${comment.id}`).empty(), "comment should be gone");
  });
});

test("history is read-only", async () => {
  let f = fixture();
  session.login({ userId: f.adminId, userName: "Ada Admin" });

  let issue = issues.view({ projectId: f.projectId }).insert({ title: "Audited" });
  let history = issueEvents.view({ issueId: issue.id });

  equal(history.length, 1);
  equal(history.at(0)?.actorName, "Ada Admin");
  await expectError(() => history.insert({ field: "status" }), "ForbiddenError");
});
