-- demo rows for local work

insert into users (email, name, role, passwordHash) values
  ('maya@tickwell.dev',   'Maya Chen',    'admin',  crypt('tickwell123', genSalt('bf', 12))),
  ('sam@tickwell.dev',    'Sam Okafor',   'member', crypt('tickwell123', genSalt('bf', 12))),
  ('jordan@tickwell.dev', 'Jordan Reyes', 'member', crypt('tickwell123', genSalt('bf', 12)));

insert into projects (key, name, description) values
  ('WEB', 'Web app',      'The customer-facing web app.'),
  ('API', 'Platform API', 'Public REST API and the services behind it.');

-- Issues are inserted in key order, so the numbering trigger gives WEB-1
-- through WEB-14 and API-1 through API-5. age is how long ago each was filed.
with rows (project, ord, title, description, status, priority, assignee, reporter, labels, age) as (
  values
    ('WEB', 1, 'Checkout button unresponsive on Safari 17',
     E'Clicking **Pay now** does nothing on Safari 17.4. No console error.\n\n1. Add an item to the cart\n2. Open checkout\n3. Click *Pay now*',
     'in_progress', 'urgent', 'sam@tickwell.dev', 'maya@tickwell.dev', array['bug', 'checkout'], interval '5 days'),
    ('WEB', 2, 'Dark mode for the dashboard',
     'Follow the system setting, with a manual override in account settings.',
     'todo', 'medium', 'jordan@tickwell.dev', 'sam@tickwell.dev', array['feature', 'design'], interval '10 days'),
    ('WEB', 3, 'Password reset email lands in spam',
     'Gmail flags it. Check SPF and DKIM on the sending domain.',
     'in_review', 'high', 'jordan@tickwell.dev', 'maya@tickwell.dev', array['bug', 'email'], interval '7 days'),
    ('WEB', 4, 'Onboarding checklist',
     E'A short checklist on a new workspace''s first sign-in:\n\n- invite a teammate\n- create a project\n- file an issue',
     'in_review', 'medium', 'jordan@tickwell.dev', 'maya@tickwell.dev', array['feature'], interval '12 days'),
    ('WEB', 5, 'Lazy-load marketing images',
     'Largest contentful paint on the marketing pages is 3.8s on a mid-range phone.',
     'done', 'medium', 'jordan@tickwell.dev', 'maya@tickwell.dev', array['performance'], interval '13 days'),
    ('WEB', 6, 'Keyboard shortcuts for the issue board',
     '`c` to create, `/` to search, arrow keys to move between cards.',
     'backlog', 'low', null, 'sam@tickwell.dev', array['feature', 'accessibility'], interval '3 days'),
    ('WEB', 7, 'Session expires while typing a long comment',
     'Renew the session on activity instead of on page load.',
     'todo', 'high', 'sam@tickwell.dev', 'jordan@tickwell.dev', array['bug'], interval '1 day'),
    ('WEB', 8, 'Avatar upload rejects HEIC photos',
     'Photos straight from an iPhone fail with "Unsupported file". Convert HEIC to JPEG on upload.',
     'todo', 'medium', 'jordan@tickwell.dev', 'sam@tickwell.dev', array['bug', 'uploads'], interval '2 days'),
    ('WEB', 9, 'Export the issue list as CSV',
     'Use the current filters, so what you see is what you get.',
     'in_progress', 'medium', 'sam@tickwell.dev', 'maya@tickwell.dev', array['feature'], interval '4 days'),
    ('WEB', 10, 'EUR invoices show a $ sign',
     E'EUR accounts get `$` on the PDF, though the amount is right. The web view is fine.',
     'in_progress', 'high', 'maya@tickwell.dev', 'sam@tickwell.dev', array['bug', 'billing'], interval '3 days'),
    ('WEB', 11, 'No focus rings on settings',
     'Tabbing through settings shows no focus indicator on the selects and toggles.',
     'in_review', 'medium', 'sam@tickwell.dev', 'jordan@tickwell.dev', array['accessibility', 'design'], interval '6 days'),
    ('WEB', 12, 'Cookie banner layout shift',
     'CLS is 0.24 on the home page. Reserve the banner''s space before it renders.',
     'done', 'medium', 'sam@tickwell.dev', 'maya@tickwell.dev', array['performance'], interval '11 days'),
    ('WEB', 13, 'Unread count in the tab title',
     'Show `(3) tickwell` when there are unread notifications.',
     'done', 'low', 'maya@tickwell.dev', 'maya@tickwell.dev', array['feature'], interval '9 days'),
    ('WEB', 14, 'Two-factor sign-in with an authenticator app',
     'TOTP codes, with ten backup codes shown once at setup.',
     'backlog', 'medium', null, 'maya@tickwell.dev', array['feature', 'security'], interval '2 days'),
    ('API', 1, 'Rate limit per API key',
     'Token bucket, 600 requests a minute by default. Return `429` with `Retry-After`.',
     'in_progress', 'high', 'maya@tickwell.dev', 'maya@tickwell.dev', array['feature', 'security'], interval '8 days'),
    ('API', 2, 'Pagination cursors break on equal timestamps',
     'Two rows with the same `createdAt` can be skipped. Use `(createdAt, id)` as the cursor.',
     'todo', 'urgent', 'jordan@tickwell.dev', 'sam@tickwell.dev', array['bug'], interval '4 days'),
    ('API', 3, 'Publish the OpenAPI spec',
     'Generate it from the route definitions and serve it at `/v1/openapi.json`.',
     'backlog', 'medium', null, 'jordan@tickwell.dev', array['docs'], interval '12 days'),
    ('API', 4, 'Webhook retries with exponential backoff',
     'Retry up to 8 times over 24 hours, then mark the endpoint as failing.',
     'in_review', 'medium', 'sam@tickwell.dev', 'maya@tickwell.dev', array['feature'], interval '6 days'),
    ('API', 5, 'Drop support for API v0',
     'Announced in March. Return `410 Gone` from every v0 route.',
     'done', 'low', 'maya@tickwell.dev', 'maya@tickwell.dev', array['cleanup'], interval '13 days')
),
inserted as (
  insert into issues (projectId, title, description, status, priority, assigneeId, reporterId, labels, createdAt)
  select p.id,
         r.title,
         r.description,
         r.status::issueStatus,
         r.priority::issuePriority,
         (select id from users where email = r.assignee),
         (select id from users where email = r.reporter),
         r.labels,
         now() - r.age
    from rows r
    join projects p on p.key = r.project
   order by r.project desc, r.ord
  returning id, reporterId, createdAt
)
insert into issueEvents (issueId, actorId, field, createdAt)
select id, reporterId, 'created', createdAt from inserted;

-- The history of how each issue got where it is. after is the time since the
-- issue was filed.
insert into issueEvents (issueId, actorId, field, fromValue, toValue, createdAt)
select i.id, u.id, e.field, e.fromValue, e.toValue, i.createdAt + e.after
  from (values
    ('WEB', 1,  interval '20 minutes',     'maya@tickwell.dev',   'assignee', null, 'Sam Okafor'),
    ('WEB', 1,  interval '21 minutes',     'maya@tickwell.dev',   'priority', 'high', 'urgent'),
    ('WEB', 1,  interval '1 day',          'sam@tickwell.dev',    'status', 'todo', 'in_progress'),
    ('WEB', 2,  interval '1 day',          'maya@tickwell.dev',   'assignee', null, 'Jordan Reyes'),
    ('WEB', 3,  interval '1 hour',         'maya@tickwell.dev',   'assignee', 'Maya Chen', 'Jordan Reyes'),
    ('WEB', 3,  interval '3 hours',        'jordan@tickwell.dev', 'status', 'todo', 'in_progress'),
    ('WEB', 3,  interval '1 day 6 hours',  'jordan@tickwell.dev', 'status', 'in_progress', 'in_review'),
    ('WEB', 4,  interval '6 days',         'maya@tickwell.dev',   'assignee', null, 'Jordan Reyes'),
    ('WEB', 4,  interval '6 days 2 hours', 'jordan@tickwell.dev', 'status', 'backlog', 'in_progress'),
    ('WEB', 4,  interval '10 days',        'jordan@tickwell.dev', 'status', 'in_progress', 'in_review'),
    ('WEB', 9,  interval '1 day',          'sam@tickwell.dev',    'assignee', null, 'Sam Okafor'),
    ('WEB', 9,  interval '1 day',          'sam@tickwell.dev',    'status', 'backlog', 'in_progress'),
    ('WEB', 5,  interval '1 day',          'jordan@tickwell.dev', 'status', 'todo', 'in_progress'),
    ('WEB', 5,  interval '3 days',         'jordan@tickwell.dev', 'status', 'in_progress', 'in_review'),
    ('WEB', 5,  interval '4 days',         'maya@tickwell.dev',   'status', 'in_review', 'done'),
    ('WEB', 7,  interval '3 hours',        'maya@tickwell.dev',   'priority', 'medium', 'high'),
    ('WEB', 10, interval '2 hours',        'maya@tickwell.dev',   'assignee', null, 'Maya Chen'),
    ('WEB', 10, interval '1 day',          'maya@tickwell.dev',   'status', 'todo', 'in_progress'),
    ('WEB', 11, interval '1 day',          'sam@tickwell.dev',    'status', 'todo', 'in_progress'),
    ('WEB', 11, interval '2 days',         'sam@tickwell.dev',    'status', 'in_progress', 'in_review'),
    ('WEB', 12, interval '1 day',          'sam@tickwell.dev',    'status', 'todo', 'in_progress'),
    ('WEB', 12, interval '2 days',         'sam@tickwell.dev',    'status', 'in_progress', 'in_review'),
    ('WEB', 12, interval '3 days',         'maya@tickwell.dev',   'status', 'in_review', 'done'),
    ('WEB', 13, interval '2 days',         'maya@tickwell.dev',   'status', 'in_progress', 'done'),
    ('API', 1,  interval '1 day',          'maya@tickwell.dev',   'status', 'todo', 'in_progress'),
    ('API', 2,  interval '30 minutes',     'maya@tickwell.dev',   'priority', 'high', 'urgent'),
    ('API', 4,  interval '2 days',         'sam@tickwell.dev',    'status', 'in_progress', 'in_review'),
    ('API', 5,  interval '5 days',         'maya@tickwell.dev',   'status', 'in_review', 'done')
  ) as e (projectKey, number, after, email, field, fromValue, toValue)
  join projects p on p.key = e.projectKey
  join issues i on i.projectId = p.id and i.number = e.number
  join users u on u.email = e.email;

insert into comments (issueId, authorId, body, createdAt)
select i.id, u.id, c.body, i.createdAt + c.after
  from (values
    ('WEB', 1,  interval '40 minutes',     'sam@tickwell.dev',    'Reproduced on 17.4. The click handler never fires because the button sits under an invisible overlay.'),
    ('WEB', 1,  interval '2 hours',        'maya@tickwell.dev',   'Good catch. Can we ship the fix today? This is blocking a customer.'),
    ('WEB', 1,  interval '1 day 2 hours',  'sam@tickwell.dev',    E'Found it. The cookie banner''s backdrop stays mounted at `opacity: 0` and takes the click. Unmounting it on dismiss fixes it.'),
    ('WEB', 1,  interval '1 day 3 hours',  'jordan@tickwell.dev', 'Checked on an iPad too, same overlay. Your fix covers it.'),
    ('WEB', 2,  interval '2 days',         'jordan@tickwell.dev', 'I''ll start with the tokens so every page picks it up at once.'),
    ('WEB', 3,  interval '5 hours',        'jordan@tickwell.dev', 'DKIM record was missing the second selector. Added it, waiting on DNS.'),
    ('WEB', 3,  interval '1 day 7 hours',  'maya@tickwell.dev',   'Test inbox score went from 4.1 to 9.6. I''ll approve once DNS has settled everywhere.'),
    ('WEB', 5,  interval '3 days 1 hour',  'jordan@tickwell.dev', 'LCP is down to 1.9s on the test phone.'),
    ('WEB', 7,  interval '2 hours',        'jordan@tickwell.dev', 'Lost a long write-up to this twice this week.'),
    ('WEB', 10, interval '4 hours',        'sam@tickwell.dev',    'Seen on two EUR accounts so far. GBP looks fine.'),
    ('WEB', 11, interval '2 days 1 hour',  'sam@tickwell.dev',    'Added a 2px accent ring to every control. Screenshots in the review.'),
    ('API', 1,  interval '1 hour',         'sam@tickwell.dev',    'Should the limit be configurable per plan?'),
    ('API', 1,  interval '3 hours',        'maya@tickwell.dev',   'Yes. Free gets 60, Team gets 600, and Enterprise is set per contract.')
  ) as c (projectKey, number, after, email, body)
  join projects p on p.key = c.projectKey
  join issues i on i.projectId = p.id and i.number = c.number
  join users u on u.email = c.email;

insert into invites (email, role, invitedById)
select 'priya@tickwell.dev', 'member', id from users where email = 'maya@tickwell.dev';
