import { test, equal, assert, sql, Email } from "@elements/app";
import IssueAssignedEmail from "#app/emails/issue-assigned";

test("assignment email", () => {
  let e = new Email({
    to: "sam@test.dev",
    subject: "[WEB-12] Maya assigned you: Fix login",
    body: new IssueAssignedEmail({ issueKey: "WEB-12", title: "Fix login", actorName: "Maya", priority: "high", url: "http://localhost/issues/WEB-12" }),
  });

  assert(e.html.includes("Maya assigned this issue to you."), e.html);
  assert(e.text.includes("http://localhost/issues/WEB-12"), e.text);
  equal(e.to, ["sam@test.dev"]);
});
