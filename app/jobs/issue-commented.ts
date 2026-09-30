import { Job, email, getAppUrl, sql } from "@elements/app";
import IssueCommentedEmail from "#app/emails/issue-commented";

export interface IssueCommentedJobFields {
  commentId: string;
}

/** Emails an issue's assignee when someone else comments on it. */
export class IssueCommentedJob extends Job<IssueCommentedJobFields> {
  run() {
    let row = sql<{ issueKey: string; title: string; body: string; authorId: string; authorName: string; assigneeId: string; to: string }>(`
      select p.key || '-' || i.number as issueKey, i.title, c.body, c.authorId, author.name as authorName, i.assigneeId, a.email as to
        from comments c
        join issues i on i.id = c.issueId
        join projects p on p.id = i.projectId
        join users a on a.id = i.assigneeId
        left join users author on author.id = c.authorId
       where c.id = ${this.fields.commentId}
    `).first();

    if (!row || row.assigneeId === row.authorId) {
      return;
    }

    email({
      to: row.to,
      subject: `[${row.issueKey}] ${row.authorName ?? "Someone"} commented: ${row.title}`,
      body: new IssueCommentedEmail({
        issueKey: row.issueKey,
        title: row.title,
        authorName: row.authorName ?? "Someone",
        body: row.body,
        url: `${getAppUrl()}/issues/${row.issueKey}`,
      }),
    });
  }
}
