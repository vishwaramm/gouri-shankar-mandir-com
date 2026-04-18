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

This repo is set up for two containers:

- `web`: Vite build served by Nginx on port `3200` by default
- `api`: Node mail/data API on port `8200` by default

The web container proxies `/api/*` to the API container, so the browser only needs one public origin.

Build and run:

```bash
docker compose up -d --build
```

Default container ports:

- web: `127.0.0.1:3200`
- api: `127.0.0.1:8200`

You can override them with environment variables:

```bash
WEB_PORT=3300 API_PORT=8300 docker compose up -d --build
```

## Linode Nginx

Use [`deploy/gouri-shankar-mandir.com.http.conf`](./deploy/gouri-shankar-mandir.com.http.conf) as the host vhost.

It should be copied into your host Nginx site config, then enabled and reloaded:

```bash
sudo cp deploy/gouri-shankar-mandir.com.http.conf /etc/nginx/sites-available/gouri-shankar-mandir.com.conf
sudo ln -s /etc/nginx/sites-available/gouri-shankar-mandir.com.conf /etc/nginx/sites-enabled/gouri-shankar-mandir.com.conf
sudo nginx -t
sudo systemctl reload nginx
```

If your registered domain differs from `gouri-shankar-mandir.com`, update the `server_name` lines and the Let’s Encrypt certificate paths after running Certbot.

## Required env vars

For persistence and email delivery:

- `MONGODB_URI`
- optional `MONGODB_DB`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- optional `SMTP_FROM`

