![Tickwell, an issue tracker built with Elements: the Web app board with issues in Backlog, Todo, In progress, In review and Done, each card showing its key, assignee, priority and labels.](https://elements.dev/demos/01a0f392-7902-78d7-b9b1-7730397930e3/poster?v=acca79506b40)

# Tickwell

> A demo app built with [Elements](https://elements.dev).

Keyed issues on a drag-and-drop board and a filtered list, with comment threads, a full change history, assignment emails and CSV import, all live.

**Demo:** [Tickwell](https://elements.dev/demos/01a0f392-7902-78d7-b9b1-7730397930e3)

## Agent specs

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

- **A live board and list.** Issues are a LiveTable opened per project. Dragging a card is an update through the view, so every open board and list moves with it. Comments and the issue history are LiveTables too.

- **History in one place.** The board, the form and the importer all create issues through one function, and every update compares the row before and after inside a transaction, recording each changed field. A database trigger hands out keys such as WEB-14.

- **Email from background jobs.** Assignments, comments and invites each schedule a job that sends its email, inside the same transaction as the change.

- **Invites and roles.** Admins invite teammates by email through an `@rpc`, and every rpc and LiveTable handler checks the signed-in user and their role.

- **CSV import as a function call.** The import page sends the file to an rpc for a preview, then inserts each row through the project's live view, so open boards fill in as the issues land.

- **Data from SQL files.** Two migrations define the tracker and seed three teammates, two projects with 19 issues, their history and comments, and a pending invite.

### What the project server gave the agent

The project server runs alongside the agent and answers as soon as a file is saved: it type-checks the templates, TypeScript and SQL, applies migrations and reruns the tests, so every question came back right away and the agent kept building.

### What shipped

The app type-checks with zero errors and all 31 tests pass. Every page works on desktop and phone, and live updates arrive across tabs, such as a card dragged to a new column.

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

**Demo:** [Tickwell](https://elements.dev/demos/01a0f392-7902-78d7-b9b1-7730397930e3)

## License

MIT. See [LICENSE](LICENSE).
