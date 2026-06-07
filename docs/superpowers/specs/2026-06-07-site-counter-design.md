# Portable per-IP-per-day site counter — design

**Date:** 2026-06-07
**Status:** Approved (pending spec review)
**Author:** Timothy Beach (with Claude Code)

## Goal

A lightweight visitor counter for timbeach.com that:

- counts each site load **once per IP per UTC day** (a refresh never bumps it; a
  genuine returning reader counts again on a new day),
- writes its state to a plain file on disk (no database),
- displays a single subtle total in the footer,
- is **portable** — the core is one self-contained file another person can copy
  onto their own PHP host and reuse with one snippet.

Non-goals (deliberate YAGNI cuts): admin dashboard, per-page counts, historical
time-series, geo-IP, real-time websockets. Just the one number.

## Server context (already verified)

- Host: Vultr Debian 11, **nginx + php-fpm 7.4**, fpm socket
  `/run/php/php7.4-fpm.sock`.
- The timbeach vhost (`/etc/nginx/sites-available/vultr-2024`) is currently
  **pure static** (`try_files $uri $uri/ =404`) — no PHP `location` block yet.
- One **shared** `/var/log/nginx/access.log` across all vhosts (not per-site).
- Webroot: `/var/www/timbeach.com`. Deploy is `rsync` (no `--delete` on the main
  tree; a scoped `--delete` only on `a/`).
- php-fpm runs as **www-data**.
- PHP 7.4 is end-of-life (Nov 2022). Code MUST be 7.4-safe. A separate future
  project will migrate to a newer OS/VPS; this counter must not depend on that.

## Chosen approach

**Approach A — single self-contained PHP file.** Rejected alternatives:

- **B. Log-parsing cron job** — elegant and zero request-time code, but its
  portability story is weaker (cron access + per-host log-format coupling +
  host-filtering the shared log + log rotation aging IPs out). Cuts against the
  "others can borrow it" goal.
- **C. Client-side only** — not viable; you cannot dedupe by IP without a
  server-side observer, and we want a self-hosted file.

## Data flow

```
browser load → fetch('/count.php')
                   │
                   ▼
            count.php (php-fpm, www-data)
              ├─ ip   = client IP (REMOTE_ADDR by default)
              ├─ hash = sha256(salt + UTC-date + ip)        ← raw IP never stored
              ├─ flock(LOCK_EX) on counter-data/.lock
              ├─ read counter-data/counter.json
              ├─ if json.date != today: json.seen = {}, json.date = today  (total carries forward)
              ├─ if !isset(json.seen[hash]) && !isBot(UA): json.total++, json.seen[hash]=1
              ├─ atomic write: counter.json.tmp → rename → counter.json
              ├─ release lock
              └─ echo {"total": N}   with  Content-Type: application/json, Cache-Control: no-store
                   │
                   ▼
        footer <span id="site-counter"> shows "👁 12,431 views"
        (stays hidden if the fetch fails — graceful degradation)
```

One `fetch` both records the visit and returns the number — single round-trip,
no separate read endpoint.

## Component 1 — `count.php` (the reusable artifact)

**Location in repo:** webroot root (`./count.php`) so it serves at
`https://timbeach.com/count.php`.

**Responsibilities:**

1. Self-bootstrap: on first run create `counter-data/` (mode 0700) beside the
   script and a random per-install salt at `counter-data/salt` (32 random bytes,
   hex). No configuration required to work.
2. Resolve client IP. Default `$_SERVER['REMOTE_ADDR']`. A clearly-commented
   config constant `TRUST_FORWARDED_FOR` (default `false`) lets a borrower behind
   Cloudflare/a proxy opt into the first `X-Forwarded-For` hop instead. Off by
   default because trusting that header without a proxy is spoofable.
3. Compute `today = gmdate('Y-m-d')` (UTC — stable regardless of server TZ).
4. Compute `hash = hash('sha256', $salt . $today . $ip)`. Store only the hash.
5. Read-modify-write `counter.json` under an exclusive `flock` on a dedicated
   `.lock` file; persist via temp-file + `rename()` (atomic on POSIX).
6. Day rollover: if stored `date` != `today`, reset `seen` to `{}` and set
   `date = today`. `total` is untouched (prior days already folded in).
7. Dedupe + bot skip: increment `total` and record the hash only when the hash
   is unseen today **and** the request is not a bot (see below).
8. Respond `{"total": <int>}` as JSON with `Cache-Control: no-store` so neither
   browser nor proxy caches the count.

**Bot skip:** conservative case-insensitive UA regex
(`bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|preview`).
On by default via a `SKIP_BOTS` constant; a borrower can flip it off. Missing UA
is treated as non-bot (still counts) to avoid under-counting privacy browsers.

**Storage file shape** (`counter-data/counter.json`):

```json
{ "date": "2026-06-07", "total": 12431, "seen": { "<sha256hex>": 1, "…": 1 } }
```

`seen` holds **only today's** hashes, so it self-bounds and resets daily. At
personal-site scale a day's unique set is small; the JSON-object form gives
`isset()` membership without scanning. (Scale caveat: at very high daily uniques
the in-memory object grows for that day only; acceptable for this use case and
documented for borrowers.)

**PHP 7.4 safety:** no enums, no named args, no `match`, no nullsafe `?->`, no
constructor promotion — nothing newer than 7.4. Verified by running the test
harness; final smoke test on the 7.4 server.

**Failure posture:** any unexpected error returns HTTP 200 with the last known
`{"total": N}` if readable, else a `204`/empty body — never a 500 that would
surface a broken counter to readers. The client hides the badge on any non-OK or
malformed response regardless.

## Component 2 — site integration (timbeach-specific glue)

- **`index.html`** — add to the footer:
  `<span id="site-counter" class="site-counter" hidden></span>`. Starts hidden
  to avoid a layout flash and to degrade gracefully when PHP is absent.
- **`js/counter.js`** — new tiny ES module:
  - `fetch('/count.php')` → parse `{total}` → set text
    `👁 ${total.toLocaleString()} views` → remove `hidden`.
  - On any failure (network, non-OK, malformed) do nothing — the span stays
    hidden. No console noise beyond a single `console.debug`.
  - Exported `initCounter()` called once from `js/app.js` bootstrap. It does not
    depend on the router and runs on every route (it's a site-wide footer).
- **`css/site.css`** — `.site-counter`: small, muted (use existing
  `--muted`/secondary text token), respects day/night theming, sits inline in
  the footer. No new color tokens.

## Component 3 — server & deploy wiring

- **nginx (one-time, manual; documented):** add a tightly-scoped block inside the
  timbeach `server { … }` so ONLY this one file executes PHP (not the whole
  webroot — prevents arbitrary `.php` execution):

  ```nginx
  location = /count.php {
      include snippets/fastcgi-php.conf;
      fastcgi_pass unix:/run/php/php7.4-fpm.sock;
  }
  ```

  Procedure: back up the vhost file first; edit only the timbeach block; leave
  every other site untouched; `nginx -t` then `systemctl reload nginx`.

- **One-time data dir** (php-fpm/www-data must own it):

  ```sh
  sudo install -d -o www-data -g www-data /var/www/timbeach.com/counter-data
  ```

  (count.php can also self-create it, but only if the webroot is www-data
  writable; pre-creating with correct ownership is the reliable path.)

- **`.gitignore`** — add `counter-data/` (live data never committed).
- **`.deployignore`** — add `counter-data/` (rsync never ships or clobbers live
  server data). `count.php` and `js/counter.js` deploy normally.

## Component 4 — portability packaging

The borrowable kit is **`count.php` + a README**. Write `docs/site-counter.md`
containing:

- the one-file install (`count.php` → your webroot),
- the one-line client snippet (the `fetch` + a target element),
- the nginx scoped-`location` block,
- the Apache `.htaccess`/shared-hosting note (where PHP "just works", zero config),
- the `counter-data/` ownership/permissions step,
- the privacy note (only salted hashes stored) and the `TRUST_FORWARDED_FOR` /
  `SKIP_BOTS` knobs.

A borrower copies one file and pastes one snippet.

## Testing strategy (TDD)

Local PHP CLI is **8.5**; the server is **7.4**. Write 7.4-safe code; test
locally with 8.5, final smoke on the server's 7.4.

A harness drives `count.php` via PHP-CLI against a throwaway temp data dir (never
the live `counter-data/`), faking `REMOTE_ADDR`, `HTTP_USER_AGENT`, and the
effective date. Assertions, written before the implementation:

1. First hit from an IP → `total` increases by 1.
2. Same IP, same day → `total` unchanged.
3. Different IP, same day → `total` +1.
4. Day rollover → `seen` resets, `total` preserved; a previously-seen IP counts
   again on the new day.
5. Bot UA → `total` unchanged; the same content from a normal UA → +1.
6. Concurrency: N parallel CLI invocations from N distinct IPs → `total` ends at
   exactly N (no lost updates under `flock`).
7. Only hashes (never raw IPs) appear in `counter.json`.
8. Malformed/missing data file is recreated rather than 500-ing.

To keep the date injectable for test 4 without polluting production, `count.php`
reads the day from a single internal helper that can be overridden via an env var
(`COUNTER_FAKE_DATE`) **only when a `COUNTER_TEST=1` env is set** — the override
is inert in production.

## Open risks / accepted trade-offs

- **Endpoint abuse:** any open endpoint can be curled. Once-per-IP-per-day caps a
  single attacker to +1/day; acceptable for a vanity counter. No rate-limiting in
  v1.
- **Shared hosting variance:** REMOTE_ADDR may be a proxy IP on some hosts; the
  `TRUST_FORWARDED_FOR` knob covers the common Cloudflare case. Documented.
- **PHP 7.4 EOL:** mitigated by keeping the code minimal and version-agnostic;
  tracked separately as the future VPS-migration project.
```

## File-change summary

| Path | Change |
|---|---|
| `count.php` | new — the counter endpoint (reusable artifact) |
| `js/counter.js` | new — footer fetch + render |
| `js/app.js` | call `initCounter()` in bootstrap |
| `index.html` | footer `<span id="site-counter">` |
| `css/site.css` | `.site-counter` styling |
| `.gitignore` | add `counter-data/` |
| `.deployignore` | add `counter-data/` |
| `docs/site-counter.md` | new — portability README |
| (server, manual) | nginx scoped `location = /count.php`; create `counter-data/` owned by www-data |
