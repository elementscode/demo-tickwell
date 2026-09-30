import { Job, email, getAppUrl, sql } from "@elements/app";
import IssueAssignedEmail from "#app/emails/issue-assigned";
import { priorityLabel } from "#app/shared/services/tracker";

export interface IssueAssignedJobFields {
  issueId: string;
  actorId: string;
}

/**
 * Emails an issue's assignee. It reads the issue when it runs, so a quick
 * reassignment emails whoever holds the issue now, and nobody if it was
 * handed straight back to the person who assigned it.
 */
export class IssueAssignedJob extends Job<IssueAssignedJobFields> {
  run() {
    let row = sql<{ issueKey: string; title: string; priority: string; assigneeId: string; to: string; actorName: string }>(`
      select p.key || '-' || i.number as issueKey, i.title, i.priority, i.assigneeId, a.email as to, actor.name as actorName
        from issues i
        join projects p on p.id = i.projectId
        join users a on a.id = i.assigneeId
        join users actor on actor.id = ${this.fields.actorId}
       where i.id = ${this.fields.issueId}
    `).first();

    if (!row || row.assigneeId === this.fields.actorId) {
      return;
    }

    email({
      to: row.to,
      subject: `[${row.issueKey}] ${row.actorName} assigned you: ${row.title}`,
      body: new IssueAssignedEmail({
        issueKey: row.issueKey,
        title: row.title,
        actorName: row.actorName,
        priority: priorityLabel(row.priority).toLowerCase(),
        url: `${getAppUrl()}/issues/${row.issueKey}`,
      }),
    });
  }
}
