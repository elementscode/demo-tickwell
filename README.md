![Tickwell, an issue tracker built with Elements: the Web app board with issues in Backlog, Todo, In progress, In review and Done, each card showing its key, assignee, priority and labels.](POSTER_URL)

# Tickwell

> A demo app built with [Elements](https://elements.dev).

Keyed issues on a drag-and-drop board and a filtered list, with comment threads, a full change history, assignment emails and CSV import, all live.

**Demo:** [Tickwell](DEMO_URL)

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
