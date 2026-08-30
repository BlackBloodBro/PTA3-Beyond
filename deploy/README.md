# Hosting PTA3 Beyond

This app's backend (database, auth, RLS) is [Supabase Cloud](https://supabase.com) -- this server only
ever needs to run the Next.js frontend container. Nothing here needs a database, Postgres, or the
Supabase CLI installed.

## One-time setup

1. Install Docker and the Docker Compose plugin if not already present.
2. Copy `docker-compose.yml` from this folder onto the server, anywhere you like (e.g.
   `~/pta3-tool/docker-compose.yml`). It's the only file you need -- no git clone required.
3. From that folder, run:
   ```bash
   docker compose up -d
   ```
4. Point your reverse proxy (nginx/Caddy/Traefik/whatever you already run) at port `3000` for
   whatever domain you want to use, and set up HTTPS the way you normally do. That part isn't included
   here since it depends on your existing setup.

That's it. From here on, updates are automatic: pushing to this project's `production` branch builds a
new image and publishes it to GitHub Container Registry as `:latest`. What actually pulls and restarts
`app` from there depends on which update mechanism this specific server runs (the `watchtower` container
in `docker-compose.yml` is one option -- polls on an interval and updates immediately; a daily cron/task
that runs `docker compose pull && docker compose up -d` at a fixed time is just as valid, just with a
coarser update cadence). Either way, no manual image-pulling is expected once one of these is running --
just be aware that a fixed-time daily check means a fix pushed to `production` right after that day's
check has already run won't reach this server until the next one, not within minutes.

## If the image is private

The image (`ghcr.io/blackbloodbro/pta3-tool`) is expected to be set to public on GitHub's side, so
`docker compose up` can pull it with no login. If it's ever private instead, you'll need one extra
step before step 3 above:
```bash
echo "<a GitHub personal access token with read:packages scope>" | docker login ghcr.io -u <your-github-username> --password-stdin
```

## Auth callback URLs

If you use your own domain, that domain needs to be added to this Supabase project's Auth settings
(Site URL / Redirect URLs), or login/signup will fail on it. That's a one-time change made in the
Supabase dashboard, not something in this repo.

## Adjusting the update check interval

`docker-compose.yml`'s `watchtower` service checks for a new image every 300 seconds (5 minutes) by
default -- change the `--interval` value (in seconds) if you want it faster or slower, then
`docker compose up -d` again to apply it.
