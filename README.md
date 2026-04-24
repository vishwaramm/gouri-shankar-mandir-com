# Gourishankar Mandir

React + Vite frontend with a small Node API for newsletter, service request, RSVP, and contact mail handling.

## Local development

Create `.env.local` with your MongoDB and SMTP settings, then run:

```bash
npm install
npm run dev
```

If you want to test the API server directly:

```bash
npm run start:api
```

## Docker layout

This repo is set up for three containers:

- `mongo`: persistent MongoDB storage for the app data
- `web`: Node web server that serves the Vite build and blog share metadata on port `3200` by default
- `api`: Node mail/data API on port `8200` by default

The web container proxies `/api/*` to the API container and serves crawlable blog post pages, so the browser only needs one public origin. The MongoDB volume keeps admin accounts and site data across rebuilds. The API also writes a persistence lock to `persistent-state/mongo-lock.json` on the host; if Mongo is ever replaced with a brand-new empty volume, the app refuses to start instead of silently using the wrong database.
The shared uploads volume stores admin profile photos locally and replaces the previous file when an admin updates their own photo.

Build and run:

```bash
docker volume create gourishankar-mandir-mongo-data
docker volume create gourishankar-mandir-admin-photo-data
docker compose up -d --build
```

If you use the bundled compose stack, you do not need to supply `MONGODB_URI` just to keep data persistent. The API points at the local Mongo service by default.
The Mongo volume is marked external, so Compose will refuse to start if that volume is missing instead of creating a fresh empty database.
The admin photo volume is also external, so profile images persist across rebuilds instead of being replaced by a new empty volume.

## Moving to a new machine

If you migrate the site to a different server, copy both Docker volumes and the persistence lock:

1. On the old machine, stop the stack:

   ```bash
   docker compose down
   ```

2. Export the Mongo volume:

   ```bash
   docker run --rm \
     -v gourishankar-mandir-mongo-data:/data/db \
     -v "$PWD:/backup" \
     alpine sh -c 'cd /data/db && tar czf /backup/mongo-data.tar.gz .'
   ```

3. Export the admin photo volume:

   ```bash
   docker run --rm \
     -v gourishankar-mandir-admin-photo-data:/data/uploads \
     -v "$PWD:/backup" \
     alpine sh -c 'cd /data/uploads && tar czf /backup/admin-photo-data.tar.gz .'
   ```

4. Copy the repository, `mongo-data.tar.gz`, `admin-photo-data.tar.gz`, and `persistent-state/mongo-lock.json` to the new machine.

5. On the new machine, create the external volumes first:

   ```bash
   docker volume create gourishankar-mandir-mongo-data
   docker volume create gourishankar-mandir-admin-photo-data
   ```

6. Restore the Mongo data:

   ```bash
   docker run --rm \
     -v gourishankar-mandir-mongo-data:/data/db \
     -v "$PWD:/backup" \
     alpine sh -c 'cd /data/db && tar xzf /backup/mongo-data.tar.gz'
   ```

7. Restore the admin photos:

   ```bash
   docker run --rm \
     -v gourishankar-mandir-admin-photo-data:/data/uploads \
     -v "$PWD:/backup" \
     alpine sh -c 'cd /data/uploads && tar xzf /backup/admin-photo-data.tar.gz'
   ```

8. Start the stack:

   ```bash
   docker compose up -d --build
   ```

If the Mongo volume and `persistent-state/mongo-lock.json` do not match, the API will refuse to start so you do not accidentally connect to a fresh empty database.

Default container ports:

- web: `127.0.0.1:3200`
- api: `127.0.0.1:8200`

You can override them with environment variables:

```bash
WEB_PORT=3300 API_PORT=8300 docker compose up -d --build
```

## Linode Nginx

Use [`deploy/gourishankarmandir.com.http.conf`](./deploy/gourishankarmandir.com.http.conf) as the host vhost.

It should be copied into your host Nginx site config, then enabled and reloaded:

```bash
sudo cp deploy/gourishankarmandir.com.http.conf /etc/nginx/sites-available/gourishankarmandir.com.conf
sudo ln -s /etc/nginx/sites-available/gourishankarmandir.com.conf /etc/nginx/sites-enabled/gourishankarmandir.com.conf
sudo nginx -t
sudo systemctl reload nginx
```

If your registered domain differs from `gourishankarmandir.com`, update the `server_name` lines and the Let’s Encrypt certificate paths after running Certbot.

## Required env vars

For persistence, email delivery, and Square payments:

- `MONGODB_URI`
- optional `MONGODB_DB`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- optional `SMTP_FROM`
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- optional `SQUARE_ENVIRONMENT` (`sandbox` or `production`)
- optional `SQUARE_BASE_URL`
- optional `SQUARE_VERSION`

Priest admin access is requested through `/priest-review`, approved by email, and then used as a normal email/password account.
By default, priest access requests go to `vishwaramm@gmail.com` in development and to both `vishwaramm@gmail.com` and `drgsm@hotmail.com` in production.
You can override that list with `ADMIN_NOTIFICATION_EMAILS` as a comma-separated set of recipients.
After approval, the login is session-based and uses the approved admin email/password account.

For the embedded Square card form in the browser:

- `VITE_SQUARE_APP_ID`
- `VITE_SQUARE_LOCATION_ID`
- optional `VITE_SQUARE_ENVIRONMENT` (`sandbox` or `production`)

These are exposed to the frontend by the API at `/api/runtime-config` so the production build does not need to hardcode them at compile time.

For canonical URLs and share metadata:

- optional `VITE_SITE_URL`

For the home/services/payment catalog:

- optional `VITE_SERVICE_CONFIG_JSON`

  - Supply a JSON string with a `serviceOfferings` array to override service names, categories, descriptions, inclusions, and contribution amounts in one place.
  - Example:

    ```bash
    VITE_SERVICE_CONFIG_JSON='{"serviceOfferings":[{"title":"Virtual Pooja","category":"Prayer","keywords":["pooja"],"body":"Custom pooja description","includes":["Sankalp review"],"contribution":"Suggested contribution from $61","contributionAmountCents":6100,"timing":"By appointment","delivery":"Virtual"}]}'
    ```

Square Web Payments SDK requires a secure context and a valid CSP. `localhost` is acceptable for development, but production should use HTTPS.
