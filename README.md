![Tickwell, an issue tracker built with Elements: the Web app board with issues in Backlog, Todo, In progress, In review and Done, each card showing its key, assignee, priority and labels.](https://elements.dev/demos/01a0f392-7902-78d7-b9b1-7730397930e3/poster?v=acca79506b40)

# Tickwell

> A demo app built with [Elements](https://elements.dev).

Keyed issues on a drag-and-drop board and a filtered list, with comment threads, a full change history, assignment emails and CSV import, all live.

**Demo:** [Tickwell](https://elements.dev/demos/01a0f392-7902-78d7-b9b1-7730397930e3)

## Agent specs

What one run of the prompt below took, from an empty Elements project to this
app.

- **Agent:** Claude Code, Opus 5.5 Medium
- **Time:** 20 min
- **Cost:** $7.25 at API rates, September 2026

## Get started

```bash
elements create tickwell -scaffold=elementscode/demo-tickwell
```

## How it's built

Tickwell needed a board and a list that every teammate sees change at once, a history of every edit, email when work is assigned or discussed, team invites and CSV import. Each of those is a part of Elements, so the agent spent its 20 minutes on the tracker itself.

### What Elements gave the app

- **A live board and list.** `issues` in `app/shared/services/tracker.ts` is a LiveTable opened per project. Dragging a card on the board is an update through the view, so every open board and list moves with it. `comments` and `issueEvents` are LiveTables too, and a trigger broadcasts each history row as the issue handlers write it.
- **History in one place.** The board, the form and the importer all create issues through `insertIssue`, and every update compares the row before and after inside a transaction, recording each changed field in `issueEvents`. A database trigger hands out keys such as WEB-14.
- **Email from background jobs.** `IssueAssignedJob`, `IssueCommentedJob` and `SendInviteJob` in `app/jobs/` each render an email template from `app/emails/`. The handlers schedule them inside the write's own transaction.
- **Invites and roles.** Admins invite by email from `/team` with the `invite` rpc in `app/pages/team/services.ts`. `adminOrThrow` and `currentUserOrThrow` in `app/shared/services/auth.ts` guard the rpcs and handlers.
- **Import as a function call.** `/projects/:key/import` sends the CSV file to `previewImport`, then `runImport` inserts each row through the project's live view, so open boards fill in as the issues land.
- **Data from SQL files.** Two migrations define the tracker and seed three teammates, two projects with 19 issues, their history and comments, and a pending invite.

### What the project server gave the agent

The project server runs alongside the agent and answers as soon as a file is saved: it type-checks the templates, TypeScript and SQL, applies migrations and reruns the tests, so every question came back right away and the agent kept building.

### What shipped

The app type-checks with zero errors and all 31 tests pass. Every page was checked on desktop and phone before publishing.

Start in `app/shared/services/tracker.ts`.

## Demo accounts

The seed creates two projects, Web app (WEB) and Platform API (API), with
19 issues spread across every status, comment threads and a change history on
the busiest ones, and a pending invite. Every account's password is
`tickwell123`, and the sign-in page lists them.

| Email                 | Role   |
| --------------------- | ------ |
| maya@tickwell.dev     | admin  |
| sam@tickwell.dev      | member |
| jordan@tickwell.dev   | member |

In development, emails (invites, assignments, comments) are written to
`.elements/logs/job.log` instead of being sent.

## The prompt

```text
Build an issue tracker named tickwell for a software team.

Two kinds of accounts: admin and member. Admins manage projects and invite
members. Everyone works on issues.

- Invite by email: an admin enters an address, the invitee gets a link to set
  a password.
- Projects have a short key (WEB). Issues get numbered keys (WEB-12).
- Issue: title, markdown description, status (backlog, todo, in progress,
  in review, done), priority (low, medium, high, urgent), assignee, labels.
- Board per project: a column per status, drag a card to change its status.
- List view: filter by status, assignee, priority and label, plus text search.
- Issue detail: comment thread and a history of every change.
- Email the assignee when an issue is assigned to them and when someone
  comments on it.
- Import issues from a Jira CSV export (columns Summary, Description, Status,
  Priority, Assignee).

Seed one admin, two members, two projects and a dozen issues across statuses.
Show the seeded logins on the sign-in page.

Board moves, new issues and comments update in real time.
```

## License

MIT. See [LICENSE](LICENSE).
