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
// 6. missing UA still counts (don't under-count privacy browsers)
check('empty UA -> 5',             counter_hit($dir, '4.4.4.4', '', '2026-06-08') === 5);
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
