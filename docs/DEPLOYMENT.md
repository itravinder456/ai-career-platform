# Deployment — AWS Free Tier

Deploys everything (frontend, api, runtime, redis) to a single free-tier EC2 instance,
with Postgres on AWS RDS and vector search on Qdrant Cloud — both free-tier-eligible but
**external to EC2**, which is what keeps one instance's RAM (1GB on a classic-free-tier
`t3.micro`) from being split six ways. `ingestion` is not deployed as a long-running
service — it's run once (and again whenever the knowledge base changes) from your own
machine, straight against the production Qdrant Cloud cluster.

> **AWS free tier covers AWS infra only.** OpenAI usage (LLM + embeddings) is billed by
> OpenAI separately, regardless of AWS tier.

> **No domain/HTTPS yet.** The site is plain HTTP over the Elastic IP or the EC2
> instance's own AWS public DNS hostname for now — good enough to verify the deploy
> works end to end. Adding a real domain + automatic HTTPS (Caddy already supports it,
> just needs a `DOMAIN` pointed at by real DNS) is a later, separate step.

## Target topology

```
Internet
  │
  ▼
EC2 (t3.micro or t4g.micro, 1 Elastic IP)
  ├─ Caddy (plain HTTP reverse proxy)  :80
  │    ├─ /api/*  → api      :8000
  │    └─ /       → frontend :3000
  ├─ frontend (Next.js)                :3000
  ├─ api (FastAPI)                     :8000  → RUNTIME_URL=http://runtime:8001
  ├─ runtime (LangGraph)               :8001  → DATABASE_URL=RDS, QDRANT_URL=Qdrant Cloud
  └─ redis (session cache)             :6379

AWS RDS (free tier)         — Postgres, shared by api + runtime
Qdrant Cloud (free tier)    — vector search, shared by api + runtime + ingestion
```

Security group on the EC2 instance: **22** (SSH, restricted to your IP), **80**. Nothing
else — Postgres/Redis/Qdrant never need to be reachable from the public internet; Redis
is only reached over the Docker Compose network, RDS's security group should only allow
inbound 5432 from the EC2 instance's security group, and Qdrant Cloud is authenticated
with an API key over HTTPS.

---

## Prerequisites

| What | Notes |
|---|---|
| AWS account (free tier) | New account gets 12 months of EC2/RDS free tier; confirm what your account actually has before picking instance sizes |
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
2. Security group: 22 from your IP only, 80 from anywhere.
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

## 4. Secrets

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
CORS_ORIGINS=["http://<elastic-ip-or-public-dns>"]
```

`REDIS_URL` and `RUNTIME_URL` are already set in
`infrastructure/docker/docker-compose.prod.yml` (pointed at the in-compose `redis`/
`runtime` services) — don't duplicate them in the env files.

Set `PUBLIC_API_URL` in the shell environment before starting the stack — it becomes
`NEXT_PUBLIC_API_URL`, the base URL the *browser* uses to call the API directly (not over
the Docker network):
```bash
export PUBLIC_API_URL=http://<elastic-ip-or-public-dns>
```
Consider adding that `export` to `~/.bashrc` (or wherever your shell loads on login) on
the box so it's always set before running `make prod-*`.

## 5. First deploy

```bash
make prod-up
make prod-ps      # api + runtime should show "healthy"
```

Verify:
```bash
curl -sf http://<elastic-ip-or-public-dns>/api/v1/health
```
and load `http://<elastic-ip-or-public-dns>` in a browser.

## 6. Ingestion — populate the knowledge base

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

> `EMBEDDING_PROVIDER` **must** be `openai` here, matching `services/runtime/.env.prod`
> and `services/api/.env.prod` — local dev ingestion defaults to Ollama
> (`nomic-embed-text`, 768-dim), but nothing in the production topology runs Ollama, and
> mixing embedding dimensions across a collection silently breaks retrieval.

Verify the point count in the Qdrant Cloud dashboard, then ask the deployed chat a real
question and confirm the answer is actually grounded (not the
"knowledge base temporarily unavailable" fallback from
`app.tools.retrieval.retrieve_context`).

## 7. Verify end-to-end

- `curl http://<elastic-ip-or-public-dns>/api/v1/health` → `200`
- Frontend loads in a browser.
- A real chat turn returns a grounded, non-generic answer.
- `make prod-logs` — clean of connection errors on startup.
- `docker stats` on the box — actual RAM headroom across `redis`/`runtime`/`api`/
  `frontend`/`caddy`. This is the real constraint on a free-tier instance; if it's tight,
  the cheapest levers are dropping `api`'s `--workers 2` to `1`
  (`infrastructure/docker/Dockerfile.api`'s `CMD`) or `redis`'s `--maxmemory` below
  128mb (`docker-compose.prod.yml`).

---

## Troubleshooting — issues hit on the first deploy

Everything below actually happened deploying to a fresh Amazon Linux 2023 box. Steps
3/4-7 above already fold the fixes in inline (so a *new* deploy shouldn't hit these) —
this section is for matching an exact symptom if something still goes wrong, or
re-deploying on a box that was set up before this doc was updated.

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
Only relevant if you chose to run ingestion (step 6) directly on the EC2 box instead of
your own machine — the box's earlier setup (git/Docker/Compose/Buildx/make) never
installs `uv`. Fix: `curl -LsSf https://astral.sh/uv/install.sh | sh` then
`source $HOME/.local/bin/env`.

---

## Redeploying after a code change

```bash
git pull
make prod-restart
```

## Updating the knowledge base

Re-run step 6 (ingestion) any time `data/` (this repo's RAG source) changes — no need to
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

- **No domain / HTTPS yet** — plain HTTP over the Elastic IP or AWS public DNS hostname.
  `infrastructure/docker/Caddyfile` already supports automatic HTTPS; adding a real
  domain later is just pointing its DNS `A` record at the Elastic IP, swapping
  `Caddyfile`'s `:80` for that hostname, and `make prod-restart` — Caddy handles the
  Let's Encrypt cert itself from there. Not done yet by choice — deferred until there's
  an actual domain to point at it.
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
| `infrastructure/docker/Caddyfile` | Reverse proxy (plain HTTP for now) |
| `infrastructure/docker/Dockerfile.{api,runtime,frontend}` | Unchanged from local dev — already production-ready |
| `services/{runtime,api,ingestion}/.env.prod.example` | Env var templates |
| `docs/LOCAL_SETUP.md` | The local-dev equivalent of this doc |
