import { LiveTable, sql, tx, ForbiddenError, NotFoundError, ValidationError } from "@elements/app";
import { adminOrThrow, currentUserOrThrow } from "#app/shared/services/auth";
import { IssueAssignedJob } from "#app/jobs/issue-assigned";
import { IssueCommentedJob } from "#app/jobs/issue-commented";

export type Status = "backlog" | "todo" | "in_progress" | "in_review" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";

export const STATUSES: { value: Status; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In progress" },
  { value: "in_review", label: "In review" },
  { value: "done", label: "Done" },
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function statusLabel(status: string): string {
  return STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function priorityLabel(priority: string): string {
  return PRIORITIES.find((p) => p.value === priority)?.label ?? priority;
}

/** Higher sorts first on the board and in the list. */
export function priorityRank(priority: string): number {
  return 3 - PRIORITIES.findIndex((p) => p.value === priority);
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
}

export interface Issue {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  projectId: string;
  number: number;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assigneeId: string | null;
  reporterId: string | null;
  labels: string[];
}

export interface Comment {
  id: string;
  createdAt: Date;
  issueId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
}

export interface IssueEvent {
  id: string;
  createdAt: Date;
  issueId: string;
  actorId: string | null;
  actorName: string | null;
  field: string;
  fromValue: string | null;
  toValue: string | null;
}

export function issueKey(project: { key: string }, issue: { number?: number }): string {
  return `${project.key}-${issue.number ?? "…"}`;
}

export function normalizeLabels(labels: string[] | undefined): string[] {
  let seen = new Set<string>();

  for (let label of labels ?? []) {
    let clean = label.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 32);
    if (clean) {
      seen.add(clean);
    }
  }

  return [...seen];
}

const STATUS_VALUES = new Set(STATUSES.map((s) => s.value));
const PRIORITY_VALUES = new Set(PRIORITIES.map((p) => p.value));

function checkIssue(item: Partial<Issue>) {
  if (!item.title?.trim()) {
    throw new ValidationError("Give the issue a title.");
  }

  if (item.title.length > 200) {
    throw new ValidationError("Keep the title under 200 characters.");
  }

  if (item.status && !STATUS_VALUES.has(item.status)) {
    throw new ValidationError(`Unknown status ${item.status}.`);
  }

  if (item.priority && !PRIORITY_VALUES.has(item.priority)) {
    throw new ValidationError(`Unknown priority ${item.priority}.`);
  }

  if (item.assigneeId && sql(`select 1 from users where id = ${item.assigneeId}`).empty()) {
    throw new ValidationError("That assignee is not on the team.");
  }
}

function userName(id: string | null): string | null {
  if (!id) {
    return null;
  }

  return sql<{ name: string }>(`select name from users where id = ${id}`).first()?.name ?? null;
}

function recordEvent(issueId: string, actorId: string | null, field: string, fromValue: string | null = null, toValue: string | null = null) {
  sql(`
    insert into issueEvents (issueId, actorId, field, fromValue, toValue)
         values (${issueId}, ${actorId}, ${field}, ${fromValue}, ${toValue})
  `);
}

/**
 * Writes one history row per field that changed. Assignees are recorded by
 * name, so the history still reads correctly after someone leaves the team.
 */
function recordChanges(before: Issue, after: Issue, actorId: string) {
  if (before.title !== after.title) {
    recordEvent(after.id, actorId, "title", before.title, after.title);
  }

  if (before.status !== after.status) {
    recordEvent(after.id, actorId, "status", before.status, after.status);
  }

  if (before.priority !== after.priority) {
    recordEvent(after.id, actorId, "priority", before.priority, after.priority);
  }

  if (before.assigneeId !== after.assigneeId) {
    recordEvent(after.id, actorId, "assignee", userName(before.assigneeId), userName(after.assigneeId));
  }

  if (before.description !== after.description) {
    recordEvent(after.id, actorId, "description");
  }

  let beforeLabels = [...before.labels].sort().join(", ");
  let afterLabels = [...after.labels].sort().join(", ");
  if (beforeLabels !== afterLabels) {
    recordEvent(after.id, actorId, "labels", beforeLabels || null, afterLabels || null);
  }
}

function notifyAssignee(issue: Issue, previousAssigneeId: string | null, actorId: string) {
  if (issue.assigneeId && issue.assigneeId !== previousAssigneeId && issue.assigneeId !== actorId) {
    new IssueAssignedJob({ issueId: issue.id, actorId }).schedule();
  }
}

/**
 * Inserts one issue as the given user. The board, the new-issue form and the
 * CSV importer all come through here, so every issue gets its history row and
 * its assignment email the same way.
 */
function insertIssue(item: Partial<Issue>, actorId: string): Issue {
  checkIssue(item);

  return tx(() => {
    let row = sql<Issue>(`
      insert into issues (id, projectId, title, description, status, priority, assigneeId, reporterId, labels)
           values (coalesce(${item.id ?? null}::uuid, uuidGenerateV7()),
                   ${item.projectId},
                   ${item.title!.trim()},
                   ${item.description ?? ""},
                   ${item.status ?? "backlog"},
                   ${item.priority ?? "medium"},
                   ${item.assigneeId || null},
                   ${actorId},
                   ${normalizeLabels(item.labels)})
      returning *
    `).firstOrThrow();

    recordEvent(row.id, actorId, "created");
    notifyAssignee(row, null, actorId);

    return row;
  });
}

export let issues: LiveTable<Issue> = new LiveTable<Issue>({
  insert: (item) => {
    let actor = currentUserOrThrow();

    return insertIssue(item, actor.id);
  },

  update: (item) => {
    let actor = currentUserOrThrow();
    checkIssue(item);

    return tx(() => {
      let before = sql<Issue>(`select * from issues where id = ${item.id} for update`).firstOrThrow("issue not found");

      let after = sql<Issue>(`
        update issues
           set title = ${item.title.trim()},
               description = ${item.description ?? ""},
               status = ${item.status},
               priority = ${item.priority},
               assigneeId = ${item.assigneeId || null},
               labels = ${normalizeLabels(item.labels)}
         where id = ${item.id}
        returning *
      `).firstOrThrow();

      recordChanges(before, after, actor.id);
      notifyAssignee(after, before.assigneeId, actor.id);

      return after;
    });
  },

  delete: (item) => {
    adminOrThrow();

    sql(`delete from issues where id = ${item.id}`);
  },
});

export let comments: LiveTable<Comment> = new LiveTable<Comment>({
  select: ({ issueId }) => sql<Comment>(`
    select c.id, c.createdAt, c.issueId, c.authorId, u.name as authorName, c.body
      from comments c
      left join users u on u.id = c.authorId
     where c.issueId = ${issueId}
  `),

  insert: (item) => {
    let actor = currentUserOrThrow();
    let body = item.body?.trim() ?? "";

    if (!body) {
      throw new ValidationError("Write something first.");
    }

    return tx(() => {
      let issue = sql<{ assigneeId: string | null }>(`select assigneeId from issues where id = ${item.issueId}`).firstOrThrow("issue not found");

      let row = sql<Comment>(`
        insert into comments (id, issueId, authorId, body)
             values (${item.id}, ${item.issueId}, ${actor.id}, ${body})
        returning id, createdAt, issueId, authorId, ${actor.name}::text as authorName, body
      `).firstOrThrow();

      if (issue.assigneeId && issue.assigneeId !== actor.id) {
        new IssueCommentedJob({ commentId: row.id }).schedule();
      }

      return row;
    });
  },

  update: () => {
    throw new ForbiddenError("Comments cannot be edited.");
  },

  delete: (item) => {
    let actor = currentUserOrThrow();

    let row = sql<Comment>(`select id, authorId from comments where id = ${item.id}`).first();
    if (!row) {
      throw new NotFoundError("comment not found");
    }

    if (row.authorId !== actor.id && actor.role !== "admin") {
      throw new ForbiddenError("You can only delete your own comments.");
    }

    sql(`delete from comments where id = ${item.id}`);
  },
});

/**
 * History is written by the issue handlers with plain sql(), and a trigger on
 * the table broadcasts each row, so the channel is pinned to a name the
 * trigger can compute.
 */
export let issueEvents: LiveTable<IssueEvent> = new LiveTable<IssueEvent>({
  channel: (partition) => (partition ? `issueEvents:${partition}` : "issueEvents"),

  select: ({ issueId }) => sql<IssueEvent>(`
    select e.id, e.createdAt, e.issueId, e.actorId, u.name as actorName, e.field, e.fromValue, e.toValue
      from issueEvents e
      left join users u on u.id = e.actorId
     where e.issueId = ${issueId}
  `),

  insert: () => {
    throw new ForbiddenError("History is read-only.");
  },

  update: () => {
    throw new ForbiddenError("History is read-only.");
  },

  delete: () => {
    throw new ForbiddenError("History is read-only.");
  },
});

export function listProjects(): Project[] {
  return sql<Project>(`select id, key, name, description from projects order by name`).all();
}

export function projectByKeyOrThrow(key: string): Project {
  let project = sql<Project>(`
    select id, key, name, description from projects where key = ${key.toUpperCase()}
  `).first();

  if (!project) {
    throw new NotFoundError(`No project ${key}.`);
  }

  return project;
}

/** Parses "WEB-12" into the issue id and its project. */
export function issueByKeyOrThrow(key: string): { project: Project; issueId: string } {
  let match = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/.exec(key);
  if (!match) {
    throw new NotFoundError(`No issue ${key}.`);
  }

  let project = projectByKeyOrThrow(match[1]);
  let issue = sql<{ id: string }>(`
    select id from issues where projectId = ${project.id} and number = ${Number(match[2])}
  `).first();

  if (!issue) {
    throw new NotFoundError(`No issue ${key}.`);
  }

  return { project, issueId: issue.id };
}
