-- Loose Ends stores exactly this. No board content, ever (SPEC §9).

create table if not exists users (
  id          text primary key,           -- Clerk user id
  email       text,
  name        text,
  created_at  timestamptz not null default now()
);

create table if not exists device_links (
  code              text primary key,     -- the short code shown in the terminal
  device_code_hash  text not null unique, -- sha256 of the secret the CLI polls with
  user_id           text references users(id) on delete cascade,
  token_hash        text,                 -- sha256 of the token; the token itself is never stored
  status            text not null default 'pending' check (status in ('pending','approved','denied')),
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  claimed_at        timestamptz           -- a token is handed over exactly once
);

create index if not exists device_links_expires_at on device_links (expires_at);

-- Only the service role touches these tables; the browser never reads them.
alter table users enable row level security;
alter table device_links enable row level security;

-- Codes are short-lived: drop anything older than a day.
-- select cron.schedule('device-links-sweep', '0 * * * *',
--   $$ delete from device_links where expires_at < now() - interval '1 day' $$);
