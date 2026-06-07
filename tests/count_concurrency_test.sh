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
