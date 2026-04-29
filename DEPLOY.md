# Production deployment

This system needs three pieces in production:

| Piece | What it serves |
|-------|----------------|
| Postgres (already running) | data |
| Node backend | `/api/*` JSON + PDF generator on port 5000 |
| Built React frontend (static files) | the SPA, on port 80/443 |

The same code base supports two paths. Pick whichever your server allows.
Both paths assume Postgres is reachable at the **private** IP `10.98.68.254`.

---

## 0. One-time prep — let the prod server reach Postgres on its private IP

SSH to the **DB host** (the one currently at `103.40.118.129`):

```bash
sudo -u postgres psql -c "SHOW config_file;"
sudo -u postgres psql -c "SHOW hba_file;"
```

Edit those two files:

* **postgresql.conf** — make sure Postgres listens on the private NIC:
  ```
  listen_addresses = '*'              # or the private IP only
  ```
* **pg_hba.conf** — allow your prod server's private IP to log in:
  ```
  host  apartment_db  postgres  10.98.68.0/24  scram-sha-256
  ```
  (use `10.98.68.<prodserver>/32` if you want to lock to one host)

Then:

```bash
sudo systemctl reload postgresql
```

Open the firewall (only on the **private** interface — leave the public one closed):

```bash
sudo ufw allow from 10.98.68.0/24 to any port 5432 proto tcp
```

Quick smoke test from the prod server:

```bash
nc -vz 10.98.68.254 5432    # should say "succeeded"
```

---

## 1. Copy the project to the prod server

```bash
ssh user@<prod-server>
git clone <your-repo>      # OR scp -r the project folder
cd "Apartment Management"
cp .env.production.example .env
nano .env                  # at minimum: change JWT_SECRET to something random
```

Generate a strong JWT secret quickly:

```bash
openssl rand -hex 48
```

Run the schema/role migrations on the DB once (skip if already done):

```bash
psql -h 10.98.68.254 -U postgres -d apartment_db -f database/schema.sql
psql -h 10.98.68.254 -U postgres -d apartment_db -f database/migrate-001-add-role.sql
node database/seed.js     # ONLY if this is a fresh DB
```

---

## Path A — Docker Compose (recommended; everything boots with one command)

The repo already ships with `backend/Dockerfile`, `frontend/Dockerfile`,
and `docker-compose.yml`. The compose file reads from `.env`.

Edit `docker-compose.yml` once and change the DB env to use the private IP.
Or simpler — let docker-compose pull from your `.env` file:

```yaml
# docker-compose.yml — edit the backend block to:
backend:
  build:
    context: .
    dockerfile: backend/Dockerfile
  env_file: .env
  ports:
    - "5000:5000"
  restart: unless-stopped

frontend:
  build:
    context: .
    dockerfile: frontend/Dockerfile
    args:
      REACT_APP_API_URL: "/api"      # served via shared nginx, see below
  ports:
    - "80:80"
  depends_on: [backend]
  restart: unless-stopped
```

Then:

```bash
docker compose build
docker compose up -d
docker compose logs -f       # watch for errors
```

The frontend container's nginx serves the built React app on port 80.
You also need it to proxy `/api` to the backend. Add this to the nginx
config inside `frontend/Dockerfile` (or replace the existing block):

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

Rebuild after the nginx change:

```bash
docker compose build frontend
docker compose up -d frontend
```

Test:

```bash
curl http://localhost/api/health      # should return {"data":{"status":"ok",...}}
```

Open `http://<prod-server>/` in a browser. Done.

---

## Path B — PM2 + nginx (no Docker)

Useful if you can't install Docker on the prod box.

```bash
# Install Node 20 LTS + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
sudo npm install -g pm2

cd "Apartment Management"
npm run install:all

# Build the frontend once (output goes to frontend/build)
cd frontend && npm run build && cd ..

# Start backend with PM2 so it auto-restarts and survives reboot
pm2 start backend/server.js --name apt-backend
pm2 save
pm2 startup        # follow the printed command to enable boot
```

Configure nginx to serve the static SPA AND proxy `/api`:

```nginx
# /etc/nginx/sites-available/apt
server {
    listen 80;
    server_name your.domain.com;

    root /home/<youruser>/Apartment Management/frontend/build;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

Enable + reload:

```bash
sudo ln -s /etc/nginx/sites-available/apt /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 2. HTTPS (strongly recommended)

If the server has a public domain name:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.com
```

Certbot edits the nginx config in place and sets up auto-renewal.

For Docker, the easiest is to put nginx in front of the compose stack, or
use Caddy/Traefik with automatic Let's Encrypt — out of scope here, but
holler if you want a snippet.

---

## 3. Routine ops

```bash
# Pull a new release & restart
git pull
docker compose build
docker compose up -d        # zero-ish downtime

# OR, PM2:
git pull
npm run install:all
cd frontend && npm run build && cd ..
pm2 restart apt-backend
sudo systemctl reload nginx
```

Watch logs:

```bash
docker compose logs -f backend       # docker
pm2 logs apt-backend                  # pm2
```

DB diagnostic from the prod server:

```bash
npm run db:diagnose
```

---

## 4. What changed compared to dev

* `.env` — `DB_HOST=10.98.68.254` (private IP), `NODE_ENV=production`,
  fresh `JWT_SECRET`.
* Frontend is **built**, not run via `npm start`. The static bundle in
  `frontend/build` is served by nginx.
* Backend is supervised (PM2 or Docker `restart: unless-stopped`) so it
  comes back after crashes / reboots.
* Public Postgres port (5432 on the public NIC) should be **closed**.
  Only allow it on the private network.

---

## 5. Common gotchas

| Symptom | Fix |
|---------|-----|
| `password authentication failed for user "postgres"` | quote the password in `.env`: `DB_PASSWORD="LEpooh2901#"` |
| `ECONNRESET` to Postgres | server requires SSL → set `DB_SSL=true`, OR firewall is dropping it |
| Frontend can't reach backend | `REACT_APP_API_URL` was wrong at **build time**. Rebuild frontend with the correct value baked in (or use `/api` and nginx proxy as above) |
| `Failed to compile` Thai PDF text shows boxes | drop `Sarabun-Regular.ttf` and `Sarabun-Bold.ttf` into `backend/utils/fonts/`, then restart backend |
