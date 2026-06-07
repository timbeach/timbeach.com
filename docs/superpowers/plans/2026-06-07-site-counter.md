# Site Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A portable, privacy-respecting visitor counter for timbeach.com that counts each visitor once per IP per UTC day and shows a single total in the footer.

**Architecture:** A single self-contained `count.php` (php-fpm) records the visit and returns `{"total": N}` in one request. State lives in a flat `counter.json` (atomic write under `flock`); only salted SHA-256 IP hashes are stored, and today's hash-set self-resets at UTC midnight. A tiny `js/counter.js` fetches the number and renders it in the footer, hiding the badge on any failure.

**Tech Stack:** PHP 7.4 (server) / PHP 8.5 (local CLI tests, 7.4-safe code), vanilla ES modules, nginx, plain CSS.

**Spec:** `docs/superpowers/specs/2026-06-07-site-counter-design.md`

**Deviation from spec (intentional):** The spec proposed a `COUNTER_FAKE_DATE`/`COUNTER_TEST` env hook to make the date injectable. Replaced with a cleaner design: `counter_hit()` takes `$today` as a parameter. Tests pass explicit dates; the web entrypoint passes `gmdate('Y-m-d')`. No env hook needed; the test seam is inert in production by construction.

---

## File Structure

| Path | Responsibility |
|---|---|
| `count.php` | **The reusable artifact.** Pure functions (`counter_hit`, `counter_read`, `counter_client_ip`, `counter_is_bot`) + a web entrypoint guarded by `PHP_SAPI !== 'cli'` so tests can include it without side effects. |
| `tests/count_test.php` | Unit behaviors: increment, dedupe, rollover, bot-skip, privacy, malformed-recovery. Run with `php`. |
| `tests/count_concurrency_test.sh` | Spawns N parallel hits from distinct IPs, asserts total == N (proves `flock` prevents lost updates). |
| `js/counter.js` | Fetch `/count.php`, render `👁 N views` in the footer, hide on failure. |
| `js/app.js` | Call `initCounter()` in `bootstrap()`. |
| `index.html` | Footer `<span id="site-counter">`. |
| `css/site.css` | `.site-counter` muted styling + separator. |
| `.gitignore` | Ignore live `counter-data/`. |
| `.deployignore` | Never publish `counter-data/` or `tests/`. |
| `docs/site-counter.md` | Portability README for borrowers. |
| (server, manual) | nginx scoped `location = /count.php`; create `counter-data/` owned by www-data. |

---

## Task 1: `count.php` core logic (TDD)

**Files:**
- Create: `count.php`
- Test: `tests/count_test.php`

- [ ] **Step 1: Write the failing test**

Create `tests/count_test.php`:

```php
<?php
// Unit tests for count.php. Run: php tests/count_test.php
require __DIR__ . '/../count.php';

$failures = 0;
function check($label, $cond) {
    global $failures;
    if ($cond) { echo "ok   - $label\n"; }
    else       { echo "FAIL - $label\n"; $failures++; }
}

// Fresh throwaway data dir (never the live counter-data/).
$dir = sys_get_temp_dir() . '/counter-test-' . getmypid();
foreach (glob("$dir/*") ?: [] as $f) { @unlink($f); }
@rmdir($dir);

// 1. first hit increments
check('first hit -> 1',            counter_hit($dir, '1.1.1.1', 'Mozilla', '2026-06-07') === 1);
// 2. same ip same day: no increment
check('same ip same day -> 1',     counter_hit($dir, '1.1.1.1', 'Mozilla', '2026-06-07') === 1);
// 3. different ip same day increments
check('new ip same day -> 2',      counter_hit($dir, '2.2.2.2', 'Mozilla', '2026-06-07') === 2);
// 4. day rollover: seen resets, total preserved, prior ip recounts
check('rollover prior ip -> 3',    counter_hit($dir, '1.1.1.1', 'Mozilla', '2026-06-08') === 3);
// 5. bot UA does not increment; same ip with normal UA does
check('bot UA -> 3',               counter_hit($dir, '9.9.9.9', 'Googlebot/2.1', '2026-06-08') === 3);
check('normal UA -> 4',            counter_hit($dir, '9.9.9.9', 'Mozilla', '2026-06-08') === 4);
// 7. privacy: only hashes on disk, never raw IPs
$json = file_get_contents("$dir/counter.json");
check('raw IP absent from store',  strpos($json, '1.1.1.1') === false);
check('sha256 hash present',       (bool) preg_match('/[0-9a-f]{64}/', $json));
// 8. malformed store recovered, not fatal
file_put_contents("$dir/counter.json", '{ not valid json ');
check('malformed recovered -> 1',  counter_hit($dir, '3.3.3.3', 'Mozilla', '2026-06-08') === 1);

// cleanup
foreach (glob("$dir/*") ?: [] as $f) { @unlink($f); }
@rmdir($dir);

echo $failures === 0 ? "\nALL PASS\n" : "\n$failures FAILURE(S)\n";
exit($failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `php tests/count_test.php`
Expected: FATAL — `require` of `count.php` fails (file does not exist yet).

- [ ] **Step 3: Write `count.php`**

Create `count.php` (PHP 7.4-safe — no enums/match/nullsafe/named-args):

```php
<?php
// count.php — portable per-IP-per-day site counter.
// Records one visit per client IP per UTC day and returns {"total": N}.
// Privacy: only salted SHA-256 IP hashes are stored, never raw IPs.
// Portable: drop this one file in a PHP web root; see docs/site-counter.md.

if (!defined('COUNTER_DATA_DIR')) {
    define('COUNTER_DATA_DIR', __DIR__ . '/counter-data');
}
const COUNTER_TRUST_FORWARDED_FOR = false; // set true ONLY behind a trusted proxy (e.g. Cloudflare)
const COUNTER_SKIP_BOTS = true;

function counter_is_bot($ua) {
    if (!COUNTER_SKIP_BOTS) { return false; }
    if ($ua === '') { return false; } // missing UA counts (don't under-count privacy browsers)
    return (bool) preg_match('/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|preview/i', $ua);
}

function counter_client_ip($server) {
    if (COUNTER_TRUST_FORWARDED_FOR && !empty($server['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $server['HTTP_X_FORWARDED_FOR']);
        return trim($parts[0]);
    }
    return isset($server['REMOTE_ADDR']) ? $server['REMOTE_ADDR'] : '0.0.0.0';
}

function counter_read($dataFile) {
    $default = ['date' => '', 'total' => 0, 'seen' => []];
    if (!is_file($dataFile)) { return $default; }
    $state = json_decode((string) file_get_contents($dataFile), true);
    if (!is_array($state) || !isset($state['total'])) { return $default; }
    if (!isset($state['seen']) || !is_array($state['seen'])) { $state['seen'] = []; }
    if (!isset($state['date'])) { $state['date'] = ''; }
    return $state;
}

// Records a hit and returns the new total. $today is injected (YYYY-MM-DD, UTC)
// so callers/tests control the calendar; the web entrypoint passes gmdate().
function counter_hit($dataDir, $ip, $ua, $today) {
    if (!is_dir($dataDir)) { @mkdir($dataDir, 0700, true); }

    $saltFile = $dataDir . '/salt';
    if (!is_file($saltFile)) {
        file_put_contents($saltFile, bin2hex(random_bytes(32)), LOCK_EX);
        @chmod($saltFile, 0600);
    }
    $salt = trim((string) file_get_contents($saltFile));

    $dataFile = $dataDir . '/counter.json';
    $lock = fopen($dataDir . '/.lock', 'c');
    if ($lock === false) {
        // Cannot acquire a lock handle: fail safe, return best-known total.
        $state = counter_read($dataFile);
        return (int) $state['total'];
    }
    flock($lock, LOCK_EX);

    $state = counter_read($dataFile);
    if ($state['date'] !== $today) {        // day rollover: reset today's set, keep total
        $state['date'] = $today;
        $state['seen'] = [];
    }

    $hash = hash('sha256', $salt . $today . $ip);
    if (!isset($state['seen'][$hash]) && !counter_is_bot($ua)) {
        $state['total'] = (int) $state['total'] + 1;
        $state['seen'][$hash] = 1;
    }

    $tmp = $dataFile . '.tmp';
    file_put_contents($tmp, json_encode($state));
    rename($tmp, $dataFile);             // atomic replace

    flock($lock, LOCK_UN);
    fclose($lock);
    return (int) $state['total'];
}

// Web entrypoint — skipped when this file is include()d from the CLI test runner.
if (PHP_SAPI !== 'cli') {
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    $ip = counter_client_ip($_SERVER);
    $ua = isset($_SERVER['HTTP_USER_AGENT']) ? (string) $_SERVER['HTTP_USER_AGENT'] : '';
    $total = counter_hit(COUNTER_DATA_DIR, $ip, $ua, gmdate('Y-m-d'));
    echo json_encode(['total' => $total]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `php tests/count_test.php`
Expected: every line `ok - …`, final line `ALL PASS`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add count.php tests/count_test.php
git commit -m "Add per-IP-per-day site counter endpoint with unit tests"
```

---

## Task 2: Concurrency test (proves `flock`)

**Files:**
- Create: `tests/count_concurrency_test.sh`

- [ ] **Step 1: Write the concurrency test**

Create `tests/count_concurrency_test.sh`:

```sh
#!/bin/sh
# Launch N parallel hits from N distinct IPs; total must end at exactly N.
# Proves flock serializes the read-modify-write (no lost updates).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${TMPDIR:-/tmp}/counter-conc-$$"
rm -rf "$DIR"
N=50

i=1
while [ "$i" -le "$N" ]; do
    php -r 'require $argv[1]; counter_hit($argv[2], $argv[3], "Mozilla", "2026-06-07");' \
        "$ROOT/count.php" "$DIR" "10.0.0.$i" &
    i=$((i + 1))
done
wait

TOTAL=$(php -r '$s = json_decode(file_get_contents($argv[1] . "/counter.json"), true); echo (int) $s["total"];' "$DIR")
rm -rf "$DIR"

if [ "$TOTAL" = "$N" ]; then
    echo "ok   - $N parallel distinct IPs -> total $TOTAL"
else
    echo "FAIL - expected $N, got $TOTAL"
    exit 1
fi
```

- [ ] **Step 2: Make it executable and run it**

Run:
```bash
chmod +x tests/count_concurrency_test.sh
./tests/count_concurrency_test.sh
```
Expected: `ok - 50 parallel distinct IPs -> total 50`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add tests/count_concurrency_test.sh
git commit -m "Add flock concurrency test for site counter"
```

---

## Task 3: Footer display (HTML + JS + CSS)

**Files:**
- Modify: `index.html` (footer block, around line 69-74)
- Create: `js/counter.js`
- Modify: `js/app.js` (imports near top; `bootstrap()` at end of file)
- Modify: `css/site.css`

- [ ] **Step 1: Add the footer span**

In `index.html`, change the footer block:

```html
    <footer class="site-footer">
      © <span id="footer-year">2026</span> Timothy D Beach
      &middot; <a href="/feed.xml">RSS</a>
      &middot; <a href="https://github.com/timbeach" target="_blank" rel="noopener">GitHub</a>
      &middot; <a href="mailto:beachtimothyd@gmail.com">Email</a>
      <span id="site-counter" class="site-counter" hidden></span>
    </footer>
```

(The separator before the count is supplied by CSS `::before` so nothing dangles while the span is `hidden`.)

- [ ] **Step 2: Create `js/counter.js`**

```js
// js/counter.js — fetch the site view count and render it in the footer.
// Fails silently (badge stays hidden) so the page degrades gracefully when
// the /count.php endpoint is unavailable.
export async function initCounter() {
  const el = document.getElementById('site-counter');
  if (!el) return;
  try {
    const res = await fetch('/count.php');
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.total !== 'number') return;
    el.textContent = `👁 ${data.total.toLocaleString()} views`;
    el.hidden = false;
  } catch (err) {
    console.debug('[counter] unavailable', err);
  }
}
```

- [ ] **Step 3: Wire `initCounter()` into bootstrap**

In `js/app.js`, add the import alongside the other imports at the top:

```js
import { initCounter } from './counter.js';
```

Then, at the end of `bootstrap()` (after `initRouter();`), add a fire-and-forget call:

```js
export function bootstrap() {
  initTheme();
  registerRoute('home', renderHome);
  registerRoute('article', ({ slug }) => {
    ensureStarfieldOff();
    return renderArticle(slug, app());
  });
  registerRoute('music', renderMusic);
  registerRoute('about', renderAbout);
  registerRoute('404', renderNotFound);
  initRouter();
  initCounter();
}
```

- [ ] **Step 4: Style the counter**

In `css/site.css`, add near the existing `.site-footer` rules:

```css
.site-counter { color: var(--fg-muted); }
.site-counter::before { content: "·"; margin: 0 .4em; }
```

- [ ] **Step 5: Verify in a local static server**

Run:
```bash
python3 -m http.server 8000 >/dev/null 2>&1 &
SRV=$!
sleep 1
curl -s http://localhost:8000/index.html | grep -q 'id="site-counter"' && echo "footer span present"
kill $SRV
```
Expected: `footer span present`. (The number won't render locally — there's no PHP on `python3 -m http.server` — which is exactly the graceful-degradation path: the span stays hidden. Full end-to-end render is verified after deploy in Task 5.)

- [ ] **Step 6: Commit**

```bash
git add index.html js/counter.js js/app.js css/site.css
git commit -m "Render site counter in footer with graceful degradation"
```

---

## Task 4: Ignore rules + portability README

**Files:**
- Modify: `.gitignore`
- Modify: `.deployignore`
- Create: `docs/site-counter.md`

- [ ] **Step 1: Ignore live data in git**

Append to `.gitignore`:

```
# Live site-counter state (created server-side, never committed)
counter-data/
```

- [ ] **Step 2: Never publish data dir or tests**

In `.deployignore`, under the "internal / tooling trees" section, add:

```
/tests/
counter-data/
```

(`count.php` and `js/counter.js` are NOT excluded — they must deploy. `counter-data/` is created server-side and must never be clobbered by rsync.)

- [ ] **Step 3: Write the portability README**

Create `docs/site-counter.md`:

````markdown
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
````

- [ ] **Step 4: Commit**

```bash
git add .gitignore .deployignore docs/site-counter.md
git commit -m "Ignore counter data; add portable site-counter README"
```

---

## Task 5: Server wiring + deploy + end-to-end smoke

This task runs against the live Vultr server. **Touch only the timbeach block; back up the vhost first; leave every other site untouched.**

**Files (server):**
- Modify: `/etc/nginx/sites-available/vultr-2024` (timbeach `server_name timbeach.com www.timbeach.com` block only)
- Create: `/var/www/timbeach.com/counter-data` (owned by www-data)

- [ ] **Step 1: Back up the live nginx vhost**

```bash
ssh vultr 'sudo cp /etc/nginx/sites-available/vultr-2024 "/etc/nginx/sites-available/vultr-2024.bk.pre-counter.$(date +%Y-%m-%d)"'
```
Expected: no output (success).

- [ ] **Step 2: Add the scoped PHP location to the timbeach block**

Insert this block immediately after the `location / { try_files $uri $uri/ =404; }` line **inside the `server_name timbeach.com www.timbeach.com;` server block** (NOT mail/redirect blocks):

```nginx
    location = /count.php {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php7.4-fpm.sock;
    }
```

Edit precisely (anchor on the timbeach `server_name`, edit only that block's first `location /`). After editing, verify the block is present exactly once:

```bash
ssh vultr 'grep -n "location = /count.php" /etc/nginx/sites-available/vultr-2024'
```
Expected: exactly one match.

- [ ] **Step 3: Test and reload nginx**

```bash
ssh vultr 'sudo nginx -t && sudo systemctl reload nginx'
```
Expected: `syntax is ok` / `test is successful`, clean reload. If `nginx -t` fails, restore the backup from Step 1 and stop.

- [ ] **Step 4: Create the writable data dir**

```bash
ssh vultr 'sudo install -d -o www-data -g www-data /var/www/timbeach.com/counter-data'
```
Expected: no output. Verify:
```bash
ssh vultr 'ls -ld /var/www/timbeach.com/counter-data'
```
Expected: `drwx... www-data www-data`.

- [ ] **Step 5: Deploy the site**

Run: `./deploy.sh`
Expected: validate/feed/share-pages steps pass, rsync uploads `count.php` and `js/counter.js`. Confirm `count.php` landed:
```bash
ssh vultr 'ls -l /var/www/timbeach.com/count.php'
```

- [ ] **Step 6: End-to-end smoke test**

```bash
curl -s https://timbeach.com/count.php
```
Expected: `{"total":1}` (first counted hit). Run again from the same machine same day — total stays the same (deduped). Confirm the data file and that no raw IP is stored:
```bash
ssh vultr 'sudo cat /var/www/timbeach.com/counter-data/counter.json'
```
Expected: JSON with `date`, a non-zero `total`, and a `seen` map of 64-hex-char hashes — no readable IPs.

- [ ] **Step 7: Verify the footer renders the number**

Load `https://timbeach.com/` in a browser; the footer shows `· 👁 N views`. (If it stays hidden, check the browser console and that `/count.php` returns JSON — see graceful-degradation note in Task 3.)

- [ ] **Step 8: Commit any final tweaks**

No code change is expected in this task. If the nginx edit required a repo-side note, commit it; otherwise this task ends with the deploy and a verified live counter.

---

## Self-Review

**Spec coverage:**
- Once-per-IP-per-day, file storage, footer total → Tasks 1, 3. ✓
- Single self-contained reusable file → `count.php` (Task 1) + README (Task 4). ✓
- Privacy (salted hashes, no raw IP) → Task 1 (`counter_hit`), asserted in test, smoke-checked Task 5 Step 6. ✓
- Concurrency (flock + atomic write) → Task 1 impl, Task 2 test. ✓
- Bot skip → Task 1 (`counter_is_bot`), asserted in test. ✓
- Day rollover bounded `seen` → Task 1, asserted in test. ✓
- Graceful degradation → Task 3 (`counter.js`), verified Task 3 Step 5. ✓
- nginx scoped location + data dir + ignore rules → Tasks 4, 5. ✓
- PHP 7.4 safety → Task 1 code uses no 8.x-only syntax; final smoke on 7.4 in Task 5. ✓
- Portability README + knobs → Task 4. ✓

**Placeholder scan:** none — all code and commands are concrete.

**Type/name consistency:** `counter_hit`, `counter_read`, `counter_client_ip`, `counter_is_bot`, `initCounter`, `#site-counter`, `.site-counter`, `counter-data/`, `count.php` used consistently across all tasks and the README. JSON shape `{date,total,seen}` consistent in impl, tests, README, and smoke check.
