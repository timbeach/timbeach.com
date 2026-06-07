# Portable site counter (`count.php`)

A single-file visitor counter: counts each visitor **once per IP per UTC day**,
stores state in a flat JSON file, and shows one number. No database, no
dependencies, no build step. Privacy-respecting — only salted SHA-256 IP
**hashes** are ever written to disk, never raw IPs.

## Install (3 steps)

1. **Copy `count.php`** into your web root.

2. **Show the number.** Add an element and a fetch wherever you want it:

   ```html
   <span id="site-counter" hidden></span>
   <script type="module">
     const el = document.getElementById('site-counter');
     try {
       const r = await fetch('/count.php');
       if (r.ok) {
         const { total } = await r.json();
         if (typeof total === 'number') {
           el.textContent = `👁 ${total.toLocaleString()} views`;
           el.hidden = false;
         }
       }
     } catch (_) { /* leave hidden on failure */ }
   </script>
   ```

3. **Let PHP write its data dir.** `count.php` self-creates `counter-data/`
   next to itself, but only if the web root is writable by the PHP user. The
   reliable way is to pre-create it owned by the PHP-FPM user:

   ```sh
   sudo install -d -o www-data -g www-data /path/to/webroot/counter-data
   ```

## Web server notes

- **Apache / typical shared hosting:** nothing to do — PHP files execute by
  default. It just works.
- **nginx:** PHP isn't wired per-file by default. Add a scoped block so ONLY
  this file executes PHP (don't enable PHP across the whole web root):

  ```nginx
  location = /count.php {
      include snippets/fastcgi-php.conf;
      fastcgi_pass unix:/run/php/php7.4-fpm.sock;  # match your PHP-FPM socket
  }
  ```

  Then `nginx -t && systemctl reload nginx`.

## Config knobs (top of `count.php`)

- `COUNTER_TRUST_FORWARDED_FOR` (default `false`) — set `true` only when behind a
  trusted proxy (e.g. Cloudflare) so the real client IP is read from
  `X-Forwarded-For`. Leaving it off avoids IP spoofing.
- `COUNTER_SKIP_BOTS` (default `true`) — skip common crawler user-agents so they
  don't inflate the count.

## How it works

`counter-data/counter.json` holds `{ "date", "total", "seen": { "<hash>": 1 } }`.
`seen` contains only **today's** hashes and resets at UTC midnight, so it never
grows unbounded. Writes are serialized with `flock` and committed atomically
(temp file + `rename`), so concurrent hits can't lose updates.

## Privacy

Raw IPs are never stored. Each IP is hashed with a per-install random salt plus
the date: `sha256(salt + date + ip)`. The salt lives in `counter-data/salt` and
never leaves the server.
