![An issue tracker with a live board, built by Claude Code on Elements: the Web app board with issues in Backlog, Todo, In progress, In review and Done, each card showing its key, assignee, priority and labels.](https://elements.dev/demos/01a0f392-7902-78d7-b9b1-7730397930e3/poster?v=acca79506b40)

# An issue tracker with a live board, built by Claude Code on Elements

> Tickwell is a full-stack app built with Claude Code on Elements.

Keyed issues on a drag-and-drop board and a filtered list, with comment threads, a full change history, assignment emails and CSV import, all live.

[Run this app on your machine](https://elements.dev/demos/01a0f392-7902-78d7-b9b1-7730397930e3). Use this demo as inspiration, or as the starting point for your own app. Your agent creates a new app with this one as the scaffold, and you prompt it to add whatever features you want.

## How it's built

Tickwell needed a board and a list that every teammate sees change at once, a history of every edit, email when work is assigned or discussed, team invites and CSV import. Each of those is a part of Elements, so the agent spent its 20 minutes on the tracker itself.

- **A live board and list.** Issues are a LiveTable opened per project. Dragging a card is an update through the view, so every open board and list moves with it. Comments and the issue history are LiveTables too.

- **History in one place.** The board, the form and the importer all create issues through one function, and every update compares the row before and after inside a transaction, recording each changed field. A database trigger hands out keys such as WEB-14.

- **Email from background jobs.** Assignments, comments and invites each schedule a job that sends its email, inside the same transaction as the change.

- **Invites and roles.** Admins invite teammates by email through an `@rpc`, and every rpc and LiveTable handler checks the signed-in user and their role.

- **CSV import as a function call.** The import page sends the file to an rpc for a preview, then inserts each row through the project's live view, so open boards fill in as the issues land.

- **Data from SQL files.** Two migrations define the tracker and seed three teammates, two projects with 19 issues, their history and comments, and a pending invite.

## Why Elements

Elements is an integrated full-stack app framework and a project server. The project server checks the agent's work as it builds: it type-checks the server and browser code, analyzes the program, applies migrations and runs the tests, then reports the results to the agent. A security mistake, such as calling a server-only function from the browser, is a compile error. The agent reads the report and fixes its own mistakes before it tells you a feature is done. The same checks run on every feature you ask for next.
