# Deployment — AWS Free Tier

Deploys everything (frontend, api, runtime, redis) to a single free-tier EC2 instance,
with Postgres on AWS RDS and vector search on Qdrant Cloud — both free-tier-eligible but
**external to EC2**, which is what keeps one instance's RAM (1GB on a classic-free-tier
`t3.micro`) from being split six ways. `ingestion` is not deployed as a long-running
service — it's run once (and again whenever the knowledge base changes) from your own
machine, straight against the production Qdrant Cloud cluster.

> **AWS free tier covers AWS infra only.** OpenAI usage (LLM + embeddings) is billed by
> OpenAI separately, regardless of AWS tier.

## Target topology

```
Internet
  │
  ▼
EC2 (t3.micro or t4g.micro, 1 Elastic IP)
  ├─ Caddy (reverse proxy, auto-TLS)   :80 / :443
  │    ├─ /api/*  → api      :8000
  │    └─ /       → frontend :3000
  ├─ frontend (Next.js)                :3000
  ├─ api (FastAPI)                     :8000  → RUNTIME_URL=http://runtime:8001
  ├─ runtime (LangGraph)               :8001  → DATABASE_URL=RDS, QDRANT_URL=Qdrant Cloud
  └─ redis (session cache)             :6379

AWS RDS (free tier)         — Postgres, shared by api + runtime
Qdrant Cloud (free tier)    — vector search, shared by api + runtime + ingestion
```

Security group on the EC2 instance: **22** (SSH, restricted to your IP), **80**, **443**.
Nothing else — Postgres/Redis/Qdrant never need to be reachable from the public internet;
Redis is only reached over the Docker Compose network, RDS's security group should only
allow inbound 5432 from the EC2 instance's security group, and Qdrant Cloud is
authenticated with an API key over HTTPS.

---

## Prerequisites

| What | Notes |
|---|---|
| AWS account (free tier) | New account gets 12 months of EC2/RDS free tier; confirm what your account actually has before picking instance sizes |
| A domain you control DNS for | Caddy needs a real DNS `A` record pointed at the Elastic IP to issue a Let's Encrypt cert — it can't get one for a bare IP |
| Qdrant Cloud account | [cloud.qdrant.io](https://cloud.qdrant.io) — free tier is a 1GB cluster, no time limit |
| OpenAI API key | Separate billing from AWS — used for both chat and embeddings in production |

---

## 1. Qdrant Cloud

1. Create a free-tier cluster at Qdrant Cloud.
2. Note the **cluster URL** and generate an **API key**.
3. Nothing else to do here — `services/ingestion/app/store.py` creates the collection
   itself (sized from `QDRANT_VECTOR_SIZE`) the first time ingestion runs against it.

## 2. AWS RDS (Postgres)

1. Launch a single-AZ `db.t3.micro` or `db.t4g.micro` Postgres instance, 20GB storage,
   in a VPC you'll also put the EC2 instance in.
2. Set a real master password (not `postgres`/`postgres` — those are the local
   `docker-compose.yml` defaults, not meant for production).
3. Security group: inbound 5432 from the EC2 instance's security group only.
4. Note the endpoint. `services/api` and `services/runtime` both point at the same
   database via `DATABASE_URL`.

## 3. AWS EC2

1. Launch a `t3.micro` or `t4g.micro` (ARM — the Dockerfiles use generic
   `python:3.12-slim`/`node:22-alpine` base images, so ARM builds fine and is worth
   using if your account's free tier includes Graviton), Amazon Linux 2023, same
   VPC/subnet as RDS.
2. Security group: 22 from your IP only, 80 + 443 from anywhere.
3. Allocate and associate an **Elastic IP** so the address survives instance restarts.
4. Install git + Docker:
   ```bash
   sudo dnf install -y git docker
   sudo systemctl enable --now docker
   sudo usermod -aG docker $USER    # skip if you're operating as root; log out/in otherwise
   ```
5. Install the Compose v2 plugin — **not** available as a dnf package on Amazon Linux
   2023 (`dnf install docker-compose-plugin` 404s; there's no such package in AL2023's
   repos), so install the binary directly as AWS's own docs recommend:
   ```bash
   DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
   mkdir -p "$DOCKER_CONFIG/cli-plugins"
   ARCH=$(uname -m); [ "$ARCH" = "aarch64" ] && ARCH=aarch64 || ARCH=x86_64
   curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$ARCH" \
     -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
   chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"
   docker compose version   # should print a version, not "command not found"
   ```
   `$HOME` here needs to be the home directory of whichever user actually runs
   `docker compose` later (`/root` if you're root, `/home/ec2-user` otherwise) — if you
   switch users after this step, repeat it for that user, or install into
   `/usr/local/lib/docker/cli-plugins/` instead, which every user can see.
6. Install the Buildx plugin — also missing from AL2023's repos, and `docker compose
   build` (which `make prod-up` runs) needs it. Same CLI-plugin-binary approach, but
   note Buildx's release assets use Go-style arch names (`amd64`/`arm64`), not
   `uname -m`'s (`x86_64`/`aarch64`), so the mapping differs from the Compose step above:
   ```bash
   ARCH=$(uname -m); case "$ARCH" in aarch64) ARCH=arm64 ;; x86_64) ARCH=amd64 ;; esac
   # Buildx's release filenames include the version, so "latest" needs the tag resolved
   # first — unlike the Compose plugin above, there's no version-free filename to fall
   # back on.
   BUILDX_TAG=$(curl -sI https://github.com/docker/buildx/releases/latest \
     | grep -i location | sed -E 's#.*/tag/(v[0-9.]+).*#\1#' | tr -d '\r')
   curl -SL "https://github.com/docker/buildx/releases/download/$BUILDX_TAG/buildx-$BUILDX_TAG.linux-$ARCH" \
     -o "$DOCKER_CONFIG/cli-plugins/docker-buildx"
   chmod +x "$DOCKER_CONFIG/cli-plugins/docker-buildx"
   docker buildx version   # should print a version, not "command not found"
   ```
   (Same `$DOCKER_CONFIG`/per-user caveat as the Compose plugin above.)
7. If a login session already had `docker` group membership added mid-session (step 4),
   it won't take effect until you reconnect — `exit` and SSH back in, or run
   `newgrp docker` to activate it in the current shell, before continuing.
8. Clone the repo onto the box:
   ```bash
   git clone <repo-url>
   cd AI-Career-Platform
   ```

## 4. Configure the domain

`infrastructure/docker/Caddyfile` reads its domain from a `DOMAIN` env var (substituted
at container start, see the `caddy` service in `docker-compose.prod.yml`) — nothing to
edit in the file itself.

1. In your DNS provider (e.g. GoDaddy), add an **A record**:
   - Host/Name: a subdomain, e.g. `ai`
   - Value: the Elastic IP
   - TTL: default is fine

   A subdomain (`ai.yourdomain.com`) rather than the bare apex domain is recommended so
   it can't conflict with anything else already using the root domain.
2. Verify DNS has actually propagated before starting the stack (avoids wasting a Let's
   Encrypt attempt against DNS that isn't live yet):
   ```bash
   dig +short ai.ravindervarikuppala.com
   ```
   until it returns the Elastic IP.
3. Export it:
   ```bash
   export DOMAIN=ai.ravindervarikuppala.com
   ```

**Do not** use the EC2 instance's own AWS public DNS hostname
(`ec2-<ip>.<region>.compute.amazonaws.com`) as a shortcut — it looks like a real domain
and is publicly resolvable, but Let's Encrypt explicitly rejects
`*.compute.amazonaws.com` by policy (`rejectedIdentifier` / "forbidden by policy"), not a
rate limit, so it will never succeed no matter how many times Caddy retries.

## 5. Secrets

Never commit filled-in production env files — `.gitignore` already excludes
`**/.env.prod`. Copy each template and fill in real values:

```bash
cp services/runtime/.env.prod.example services/runtime/.env.prod
cp services/api/.env.prod.example      services/api/.env.prod
```

**`services/runtime/.env.prod`** — key values:
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=<real key>
OPENAI_MODEL=gpt-4.1-mini
DATABASE_URL=postgresql://<user>:<password>@<rds-endpoint>:5432/<db-name>
QDRANT_URL=<qdrant cloud cluster url>
QDRANT_API_KEY=<qdrant cloud api key>
QDRANT_VECTOR_SIZE=1536
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
```

**`services/api/.env.prod`** — key values:
```env
DATABASE_URL=<same RDS endpoint as above>
QDRANT_URL=<qdrant cloud cluster url>
QDRANT_API_KEY=<qdrant cloud api key>
ADMIN_SECRET_KEY=<generate fresh — python -c "import secrets; print(secrets.token_hex(32))">
CORS_ORIGINS=["https://ai.ravindervarikuppala.com"]
```

`REDIS_URL` and `RUNTIME_URL` are already set in
`infrastructure/docker/docker-compose.prod.yml` (pointed at the in-compose `redis`/
`runtime` services) — don't duplicate them in the env files.

Set `DOMAIN` (step 4) and `PUBLIC_API_URL` in the shell environment **before** starting
the stack — `PUBLIC_API_URL` becomes `NEXT_PUBLIC_API_URL`, the base URL the *browser*
uses to call the API directly (not over the Docker network), so it must be the same
public hostname as `DOMAIN`, with a scheme:
```bash
export PUBLIC_API_URL=https://$DOMAIN
```
Consider adding both `export`s to `~/.bashrc` (or wherever your shell loads on login) on
the box so they're always set before running `make prod-*`.

This one matters more than a typical env var: `NEXT_PUBLIC_API_URL` is baked into the
frontend's JS bundle at **build time** (`infrastructure/docker/Dockerfile.frontend`
takes it as a build `ARG`, passed from `docker-compose.prod.yml`'s `build.args`) — not
read at container start. `make prod-up`/`prod-restart` always rebuild
(`docker compose ... up -d --build`), so exporting it before those is correct and
sufficient; just know that changing `PUBLIC_API_URL` later requires an actual rebuild of
the `frontend` image, not merely a restart of the container — `make prod-restart`
already does this for you.

## 6. Database migrations

`services/api` owns 3 real tables (`profile`, `social_links`, `profile_stats` —
everything career-related comes from RAG over `services/ingestion`'s documents instead
of structured rows, so those are the only ones Alembic manages) via Alembic migrations
under `services/api/alembic/`. RDS starts empty; nothing creates these tables
automatically. `Dockerfile.api` doesn't copy the `alembic/` directory or `alembic.ini`
into the built image (only `app/`), so this has to run from the cloned source on the
box, not inside the deployed container:

```bash
cd ~/ai-career-platform/services/api
cp .env.prod .env   # alembic/env.py reads plain .env via AppSettings, not .env.prod
uv sync
uv run alembic upgrade head
```

(Install `uv` first if you haven't already — `curl -LsSf https://astral.sh/uv/install.sh
| sh && source $HOME/.local/bin/env`, same as the ingestion step below.)

Without this, the API container stays "healthy" (its healthcheck is a plain liveness
ping, not a schema check) but `GET /api/v1/profile` and anything reading `profile_stats`
(the frontend Hero's stat numbers) 500 — the table just doesn't exist yet.

## 7. First deploy

```bash
make prod-up
make prod-ps      # api + runtime should show "healthy"
```

Verify:
```bash
curl -sf https://$DOMAIN/api/v1/health
curl -sf https://$DOMAIN/api/v1/profile   # confirms migrations landed
```
and load `https://$DOMAIN` in a browser. First load may take a few extra seconds while
Caddy requests the Let's Encrypt cert.

## 8. Ingestion — populate the knowledge base

Preferably run this **from your own machine**, not the EC2 box — no need to deploy
`ingestion` as a container for a job that only runs occasionally. If you'd rather run it
on the box anyway, install `uv` there first (it's not part of the earlier Docker/git/make
setup, and the box doesn't need it for anything else):
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
```
`uv run` provisions a matching Python 3.12 itself if the box's default `python3` is
older — no separate Python install needed either way.

```bash
cp services/ingestion/.env.prod.example services/ingestion/.env.prod
# fill in QDRANT_URL / QDRANT_API_KEY (same Qdrant Cloud cluster) and OPENAI_API_KEY
cp services/ingestion/.env.prod services/ingestion/.env
cd services/ingestion && uv run python -m app.cli
```

`AppSettings` (`shared/core/core/config/base.py`) always reads a literal `.env` file —
`api`/`runtime` get `.env.prod`'s values "for free" because `docker-compose.prod.yml`'s
`env_file:` injects them as real container environment variables (which
`pydantic-settings` reads ahead of any file), but `ingestion` runs directly on the host
with no such translation layer, so the `.env.prod` → `.env` copy is what actually makes
its values visible at all — not a formality.

> `EMBEDDING_PROVIDER` **must** be `openai` here, matching `services/runtime/.env.prod`
> and `services/api/.env.prod` — local dev ingestion defaults to Ollama
> (`nomic-embed-text`, 768-dim), but nothing in the production topology runs Ollama, and
> mixing embedding dimensions across a collection silently breaks retrieval.

Verify the point count in the Qdrant Cloud dashboard, then ask the deployed chat a real
question and confirm the answer is actually grounded (not the
"knowledge base temporarily unavailable" fallback from
`app.tools.retrieval.retrieve_context`).

## 9. Verify end-to-end

- `curl https://$DOMAIN/api/v1/health` → `200`
- Frontend loads over HTTPS with a valid cert.
- A real chat turn returns a grounded, non-generic answer.
- `make prod-logs` — clean of connection errors on startup.
- `docker stats` on the box — actual RAM headroom across `redis`/`runtime`/`api`/
  `frontend`/`caddy`. This is the real constraint on a free-tier instance; if it's tight,
  the cheapest levers are dropping `api`'s `--workers 2` to `1`
  (`infrastructure/docker/Dockerfile.api`'s `CMD`) or `redis`'s `--maxmemory` below
  128mb (`docker-compose.prod.yml`).

---

## Troubleshooting — issues hit on the first deploy

Everything below actually happened deploying to a fresh Amazon Linux 2023 box. Steps 3
(sub-steps 4-7) and 4 above already fold the fixes in inline (so a *new* deploy
shouldn't hit these) — this section is for matching an exact symptom if something still
goes wrong,
or re-deploying on a box that was set up before this doc was updated.

**`git: command not found`**
Amazon Linux 2023's base AMI doesn't include git. Fix: `sudo dnf install -y git`
(bundled into step 4's `dnf install -y git docker` above).

**`sudo dnf install -y docker-compose-plugin` → "No match for argument:
docker-compose-plugin"**
Not a real package in AL2023's dnf repos, despite being the standard install path on
Ubuntu/Debian. Fix: install the Compose v2 binary directly as a CLI plugin (step 5) —
`curl` it from `docker/compose`'s GitHub releases into `~/.docker/cli-plugins/`.

**`make: command not found`**
Not preinstalled either. Fix: `sudo dnf install -y make`.

**`unable to get image 'redis:7-alpine': permission denied while trying to connect to
the docker API at unix:///var/run/docker.sock`**
`usermod -aG docker $USER` only takes effect on a *new* login session — running it
doesn't change the group of your *current* shell. Fix: `exit` and SSH back in (or
`newgrp docker` to activate it without reconnecting, staying in that subshell). `sudo
<command>` also works as an immediate one-off, since root bypasses the socket
permission check entirely.

**`compose build requires buildx 0.17.0 or later`**
Same story as Compose — Buildx isn't a real AL2023 dnf package either. Fix: install it
the same way, as a CLI-plugin binary (step 6). Note its release filenames use Go-style
arch names (`amd64`/`arm64`), not `uname -m`'s (`x86_64`/`aarch64`) that the Compose
step uses — the mapping is different between the two.

**`target frontend: failed to solve: process "/bin/sh -c addgroup --system app &&
adduser --system --group app" did not complete successfully: exit code: 1`**
A real bug, not an environment gap — `Dockerfile.frontend` (`node:22-alpine`, so
`adduser` is BusyBox's minimal implementation) used Debian-`adduser` syntax (`--system
--group`, which auto-creates a matching group as one step). BusyBox has no `--group`
long option; its equivalent is `--ingroup <existing-group>`, which requires the group to
already exist. `Dockerfile.api`/`Dockerfile.runtime` were never affected — they're
`python:3.12-slim` (Debian, real `adduser`). Local dev never caught this because `make
dev-frontend` runs `npm run dev` directly, bypassing the Dockerfile entirely — this only
ever surfaced on the first real production build. Fixed in the Dockerfile itself:
`adduser --system --ingroup app app` (`addgroup` already created the group the line
before). Verified with a real local `docker build`, not just reasoned about.

**`runtime` (and/or `api`) stuck `unhealthy`, blocking dependents from starting** — two
independent bugs stack here, both real, both now fixed in the repo:

1. `docker-compose.yml`'s and `docker-compose.prod.yml`'s `healthcheck:` for `runtime`/
   `api` used `curl -sf http://localhost:.../api/v1/health || exit 1` — but neither
   image installs `curl` (`python:3.12-slim` doesn't include it, and neither Dockerfile
   adds it). The healthcheck command itself was un-runnable (`curl: not found`), so it
   could never report healthy regardless of whether the app was actually fine.
   `Dockerfile.{runtime,api}` already define a *working* `HEALTHCHECK` using Python's
   `urllib` instead — fixed by simply deleting the broken compose-level override so the
   image's own one applies (Compose only uses its own `healthcheck:` when one is given;
   omitting it falls back to the image's `HEALTHCHECK`).
2. Underneath that, the app was failing to start at all: `exec /app/.venv/bin/uvicorn:
   no such file or directory`. `uv sync` (in the Dockerfile's builder stage) bakes the
   *builder's own absolute path* into every console-script shebang under `.venv/bin/`
   (e.g. `#!/build/services/runtime/.venv/bin/python`) — that path doesn't exist in the
   final stage, where `.venv` gets `COPY`'d to `/app/.venv` instead, so directly `exec`ing
   `uvicorn` fails. `python` itself has no such problem (it's a plain symlink, not a
   shebang script) and correctly activates the venv via `PATH` + `pyvenv.cfg` regardless
   of where it's invoked from. Fixed by changing both Dockerfiles' `CMD` from
   `["uvicorn", ...]` to `["python", "-m", "uvicorn", ...]`.

Both verified locally end-to-end: built the real image, ran it against a real (throwaway)
Postgres container, and confirmed `docker inspect`'s `.State.Health.Status` actually
reached `healthy` with a `0` exit code — not just inferred from reading the Dockerfiles.

**`uv: command not found` running ingestion**
Only relevant if you chose to run ingestion (step 8) directly on the EC2 box instead of
your own machine — the box's earlier setup (git/Docker/Compose/Buildx/make) never
installs `uv`. Fix: `curl -LsSf https://astral.sh/uv/install.sh | sh` then
`source $HOME/.local/bin/env`.

**Frontend requests still go to `localhost:8000` even after exporting `PUBLIC_API_URL`
and restarting** — a real bug, not a timing/ordering mistake. `NEXT_PUBLIC_API_URL`
(and every `NEXT_PUBLIC_*` var) gets inlined into the JS bundle at `next build` time —
Next.js literally replaces `process.env.NEXT_PUBLIC_API_URL` with a hardcoded string
during the build, in both server and client bundles. `docker-compose.prod.yml` was
originally passing it as a container-start `environment:` value, which has no effect
whatsoever on code that was already compiled during `docker build`, so it silently kept
whatever the build saw — `undefined`, falling back to the `"http://localhost:8000"`
default in `frontend/src/services/{chat,admin,profile}.ts`. Fixed by moving it to
`Dockerfile.frontend`'s `ARG`/`ENV` (set before `RUN npm run build`) and
`docker-compose.prod.yml`'s `build.args` instead of `environment:`. `export
PUBLIC_API_URL=...` before `make prod-up`/`prod-restart` was always the right sequence
(both targets rebuild via `--build`) — the bug was that the value never reached the
build step at all, regardless of when it was exported. Verified by building the real
image with the fix and grepping the compiled `.next/` output for the actual URL —
present in both server and client chunks, no trace of the `localhost:8000` fallback
remaining anywhere.

**`caddy` logs: "Cannot issue for \"ec2-*.compute.amazonaws.com\": The ACME server
refuses to issue a certificate for this domain name, because it is forbidden by
policy"**
Not a transient failure — Let's Encrypt permanently blocklists AWS's (and other cloud
providers') generic public DNS hostname suffixes from issuance, by policy. Caddy will
keep retrying (every 60s, backing off) for up to 30 days and never succeed, no matter
how long you wait. `DOMAIN` **must** be a hostname you actually control DNS for (step 4)
— a subdomain of a real domain you own, pointed at the Elastic IP via an `A` record.

**Browser: "This site can't provide a secure connection" / `ERR_SSL_PROTOCOL_ERROR`**
Caddy only matches traffic for the exact hostname it's configured with (`DOMAIN`, step
4) — browsing to anything else (the bare Elastic IP, or a hostname `DOMAIN` isn't set
to) has no matching site, so there's no cert to present and the TLS handshake itself
fails, rather than falling through to a default page. Fix: make sure `DOMAIN` is
exported to the exact hostname you're actually browsing to, then `make prod-restart` so
`caddy` picks up the new value and requests a fresh cert for it.

**`frontend` logs: "Error: EACCES: permission denied, mkdir '/app/.next/cache'"**
A real bug, not a runtime fluke — `Dockerfile.frontend`'s `COPY --from=builder` lines ran
with no `--chown`, so every copied file landed owned by `root` (COPY always runs as
root, regardless of the `USER app` instruction later in the file). At runtime, the
Next.js standalone server tries to create `.next/cache` (image optimization cache, etc.)
as the non-root `app` user, which has no write permission on the root-owned `.next`
directory. Fixed by adding `--chown=app:app` to every `COPY --from=builder`/`COPY` line
in the runtime stage. Verified locally: built the real image, ran it as the `app` user,
confirmed `/app/.next` is now `app`-owned and `mkdir /app/.next/cache` actually succeeds.

---

## Redeploying after a code change

```bash
git pull
make prod-restart
```

## Updating the knowledge base

Re-run step 8 (ingestion) any time `data/` (this repo's RAG source) changes — no need to
touch the deployed containers, ingestion writes straight to the shared Qdrant Cloud
cluster.

## Makefile reference

| Command | What it does |
|---|---|
| `make prod-build` | Build production images without starting them |
| `make prod-up` | Build + start the production stack (detached) |
| `make prod-down` | Stop and remove production containers |
| `make prod-restart` | `prod-down` + `prod-up` |
| `make prod-logs` | Tail all production logs |
| `make prod-ps` | Show container status/health |

---

## Known limitations

- **No CI/CD** — deploys are manual (`git pull && make prod-restart`) for now.
- **No auto-restart on host reboot** beyond Docker's `restart: unless-stopped` (already
  set on every service) plus `systemctl enable docker` so Docker itself comes back on
  boot.
- **No multi-AZ / high availability** — one box, acceptable for a portfolio demo, not
  for anything needing real uptime guarantees.
- **Backups** — only RDS's default automated backup window; nothing extra configured.

## Related files

| File | Purpose |
|---|---|
| `infrastructure/docker/docker-compose.prod.yml` | Production topology |
| `infrastructure/docker/Caddyfile` | Reverse proxy + automatic TLS |
| `infrastructure/docker/Dockerfile.{api,runtime,frontend}` | Unchanged from local dev — already production-ready |
| `services/{runtime,api,ingestion}/.env.prod.example` | Env var templates |
| `docs/LOCAL_SETUP.md` | The local-dev equivalent of this doc |
