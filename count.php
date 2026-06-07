<?php
// count.php — portable per-IP-per-day site counter.
// Records one visit per client IP per UTC day and returns {"total": N}.
// Privacy: only salted SHA-256 IP hashes are stored, never raw IPs.
// Portable: drop this one file in a PHP web root; see docs/site-counter.md.
// Canonical source: https://github.com/timbeach/site-counter (this is a vendored copy).

if (!defined('COUNTER_DATA_DIR')) {
    define('COUNTER_DATA_DIR', __DIR__ . '/counter-data');
}
if (!defined('COUNTER_TRUST_FORWARDED_FOR')) {
    define('COUNTER_TRUST_FORWARDED_FOR', false); // set true ONLY behind a trusted proxy (e.g. Cloudflare)
}
if (!defined('COUNTER_SKIP_BOTS')) {
    define('COUNTER_SKIP_BOTS', true);
}

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
    $default = array('date' => '', 'total' => 0, 'seen' => array());
    if (!is_file($dataFile)) { return $default; }
    $state = json_decode((string) file_get_contents($dataFile), true);
    if (!is_array($state) || !isset($state['total'])) { return $default; }
    if (!isset($state['seen']) || !is_array($state['seen'])) { $state['seen'] = array(); }
    if (!isset($state['date'])) { $state['date'] = ''; }
    return $state;
}

// Records a hit and returns the new total. $today is injected (YYYY-MM-DD, UTC)
// so callers/tests control the calendar; the web entrypoint passes gmdate().
function counter_hit($dataDir, $ip, $ua, $today) {
    if (!is_dir($dataDir) && !@mkdir($dataDir, 0700, true)) {
        error_log("count.php: cannot create data dir $dataDir");
    }

    $dataFile = $dataDir . '/counter.json';
    $lock = fopen($dataDir . '/.lock', 'c');
    if ($lock === false) {
        error_log("count.php: cannot open lock file in $dataDir");
        $state = counter_read($dataFile); // fail safe: best-known total
        return (int) $state['total'];
    }

    flock($lock, LOCK_EX);
    try {
        // Salt is created/read inside the lock so concurrent first-requests
        // can't generate two different salts.
        $saltFile = $dataDir . '/salt';
        if (!is_file($saltFile)) {
            file_put_contents($saltFile, bin2hex(random_bytes(32)));
            @chmod($saltFile, 0600);
        }
        $salt = trim((string) file_get_contents($saltFile));

        $state = counter_read($dataFile);
        if ($state['date'] !== $today) { // day rollover: reset today's set, keep total
            $state['date'] = $today;
            $state['seen'] = [];
        }

        $hash = hash('sha256', $salt . $today . $ip);
        if (!isset($state['seen'][$hash]) && !counter_is_bot($ua)) {
            $state['total'] = (int) $state['total'] + 1;
            $state['seen'][$hash] = 1;
        }

        $json = json_encode($state);
        if ($json !== false) {
            $tmp = $dataFile . '.tmp';
            if (file_put_contents($tmp, $json) !== false) {
                rename($tmp, $dataFile); // atomic replace
            } else {
                error_log("count.php: cannot write $tmp");
            }
        }
        return (int) $state['total'];
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

// Web entrypoint — skipped when this file is include()d from the CLI test runner.
if (PHP_SAPI !== 'cli') {
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    $ip = counter_client_ip($_SERVER);
    $ua = isset($_SERVER['HTTP_USER_AGENT']) ? (string) $_SERVER['HTTP_USER_AGENT'] : '';
    $total = counter_hit(COUNTER_DATA_DIR, $ip, $ua, gmdate('Y-m-d'));
    echo json_encode(array('total' => $total));
}
