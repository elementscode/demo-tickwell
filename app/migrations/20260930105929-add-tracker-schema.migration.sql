-- add tracker schema

-- Auto-update updatedAt on row changes.
create or replace function touchUpdatedAt()
returns trigger
language plpgsql
as $$
begin
  new.updatedAt = now();
  return new;
end;
$$;

create type userRole as enum ('member', 'admin');
create type issueStatus as enum ('backlog', 'todo', 'in_progress', 'in_review', 'done');
create type issuePriority as enum ('low', 'medium', 'high', 'urgent');

create table users (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  email text not null unique,
  name text not null,
  passwordHash text not null,
  role userRole not null default 'member'
);

create trigger usersTouchUpdatedAt
  before update on users
  for each row execute function touchUpdatedAt();

-- The token is its own random column, not the id: a uuidv7 id leaks its
-- creation time and carries fewer random bits than a link secret should.
create table invites (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  email text not null,
  role userRole not null default 'member',
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invitedById uuid references users(id) on delete set null,
  expiresAt timestamptz not null default now() + interval '7 days',
  acceptedAt timestamptz
);

create index invitesEmailIdx on invites (email);

create trigger invitesTouchUpdatedAt
  before update on invites
  for each row execute function touchUpdatedAt();

create table projects (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  key text not null unique check (key ~ '^[A-Z][A-Z0-9]{1,9}$'),
  name text not null,
  description text not null default '',
  nextNumber integer not null default 1
);

create trigger projectsTouchUpdatedAt
  before update on projects
  for each row execute function touchUpdatedAt();

create table issues (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  projectId uuid not null references projects(id) on delete cascade,
  number integer not null,
  title text not null,
  description text not null default '',
  status issueStatus not null default 'backlog',
  priority issuePriority not null default 'medium',
  assigneeId uuid references users(id) on delete set null,
  reporterId uuid references users(id) on delete set null,
  labels text[] not null default '{}',
  unique (projectId, number)
);

create index issuesProjectIdIdx on issues (projectId);

create trigger issuesTouchUpdatedAt
  before update on issues
  for each row execute function touchUpdatedAt();

-- Every path that creates an issue (the app, the importer, a seed, psql) gets
-- the next number for its project, and the row lock on the project serializes
-- two creates racing for the same one.
create or replace function issuesAssignNumber()
returns trigger
language plpgsql
as $$
begin
  update projects
     set nextNumber = nextNumber + 1
   where id = new.projectId
  returning nextNumber - 1 into new.number;

  return new;
end;
$$;

create trigger issuesAssignNumberTrigger
  before insert on issues
  for each row execute function issuesAssignNumber();

create table comments (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  issueId uuid not null references issues(id) on delete cascade,
  authorId uuid references users(id) on delete set null,
  body text not null
);

create index commentsIssueIdIdx on comments (issueId);

create trigger commentsTouchUpdatedAt
  before update on comments
  for each row execute function touchUpdatedAt();

create table issueEvents (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  issueId uuid not null references issues(id) on delete cascade,
  actorId uuid references users(id) on delete set null,
  field text not null,
  fromValue text,
  toValue text
);

create index issueEventsIssueIdIdx on issueEvents (issueId);

create trigger issueEventsTouchUpdatedAt
  before update on issueEvents
  for each row execute function touchUpdatedAt();

-- History rows are written with plain sql() from the issue handlers and the
-- importer, so the write itself is the broadcast to open issue pages.
create or replace function issueEventsNotify()
returns trigger
language plpgsql
as $$
declare
  r record;
  payload text;
begin
  r := coalesce(new, old);

  payload := json_build_object(
    'op', lower(tg_op),
    'data', json_build_object(
      'id', r.id,
      'createdAt', json_build_object('$type', 'Date', '$value', (extract(epoch from r.createdAt) * 1000)::bigint),
      'issueId', r.issueId,
      'actorId', r.actorId,
      'actorName', (select name from users where id = r.actorId),
      'field', r.field,
      'fromValue', r.fromValue,
      'toValue', r.toValue
    )
  )::text;

  if octet_length(payload) >= 8000 then
    payload := json_build_object('op', lower(tg_op), 'id', r.id)::text;
  end if;

  perform pg_notify(channel_name('issue_events'), payload);

  return r;
end;
$$;

create trigger issueEventsNotifyTrigger
  after insert or update or delete on issueEvents
  for each row execute function issueEventsNotify();
