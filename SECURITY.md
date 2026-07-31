# Security — secret handling

## What happened (Aug 2025 incident)

The Telegram bot token was leaked because `.env` was committed in the repo's
**initial commit** (`630e838`) and in three later commits, on a **public**
GitHub repo. A later commit (`87ecb51`) added `.env` to `.gitignore` and
untracked it — but that only stops *future* commits. The file was still
readable in git history at `origin/main` and every branch derived from it,
so anyone could run `git log -p` (or use an automated GitHub secret scanner)
and read the token. That is how the bot's title and description were changed.

Also leaked in the same commits: the production `DATABASE_URL`, including
its password.

## Rules

1. Secrets live in `.env` only. `.env` is git-ignored; `.env.example` holds
   placeholder names and is the only env file that gets committed.
2. Read secrets via `process.env.X`. Never inline a literal token, password,
   or connection string in source, docs, test fixtures, or `attached_assets/`.
3. Never commit `cookies.txt`, `*.pem`, `*.key`, or session dumps.
4. Untracking a secret is **not** remediation. If a secret has ever been
   committed, assume it is compromised and rotate it.

## The pre-commit guard

`.githooks/pre-commit` blocks commits containing secret-shaped content. Enable
it after cloning (`npm install` does this automatically via `prepare`):

```bash
npm run setup:hooks
```

It blocks by filename (`.env*`, `cookies.txt`, key files) and by content
(Telegram tokens, postgres URLs with passwords, `SECRET=`/`API_KEY=` style
assignments, AWS keys, `sk-`/`pk-` keys). Placeholders such as
`your_token_here` are allowed. To bypass a genuine false positive:
`git commit --no-verify`.

## Rotation runbook

When a secret is exposed:

1. **Revoke first, investigate second.**
   - Telegram: message [@BotFather](https://t.me/BotFather) → `/revoke` → pick
     the bot. This invalidates the old token immediately and issues a new one.
     Then check `/setname`, `/setdescription`, `/setabouttext`, and
     `/setuserpic` — an attacker with the token can change all of these.
     Also call `deleteWebhook` in case one was pointed at their server:
     `curl "https://api.telegram.org/bot<NEW_TOKEN>/deleteWebhook"`.
   - Postgres: `ALTER USER carpool_user WITH PASSWORD '<new>';` and audit the
     database for unexpected writes.
2. Put the new value in `.env` on every host (local, Replit, PM2 server).
   Restart the app.
3. Purge it from git history (see below) — otherwise scanners keep finding it.
4. Turn on GitHub push protection so this is caught server-side:
   repo → Settings → Code security → Secret scanning → enable **Secret
   scanning** and **Push protection**.

## Purging history

This rewrites every commit hash. Coordinate with anyone who has a clone, and
note that **forks keep the old history** — the repo has a fork, so the token
must be revoked regardless of the rewrite.

```bash
pip install git-filter-repo
git clone --mirror https://github.com/Tameem1/Carpool_server.git carpool-mirror
cd carpool-mirror
git filter-repo --invert-paths --path .env --path .env.backup --path cookies.txt
git push --force --mirror
```

Afterwards, everyone re-clones. Do not `git pull` into an old clone.
