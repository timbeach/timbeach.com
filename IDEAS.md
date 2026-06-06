# timbeach.com — Article Idea Backlog

Durable home for parked article ideas. Survives circle-back archiving (those get
`Ctrl-D`'d away); this file is version-controlled in the site repo.

**Convention:** when you "park an article," append an entry here (newest at top).
Keep the circle-back for *session resume*; this file owns the *idea backlog*.
Find them anytime with the `article-ideas` alias.

Format per entry:
```
## <title>            (<date parked>)
Hook: <the angle / why it's interesting>
Source: <draft path, STATUS doc, and/or `claude --resume <session-id>`>
Status: idea | drafting | draft-ready | published
```

---

## Remediating vendored PHP deps under an SCA scanner — the gotchas   (2026-06-04)
Hook: Three traps that turn a "just bump the version" ticket into real analysis:
(1) Sonatype's *suggested* fix version was itself CVE'd (newer 2026 CVEs hit
1.30.2 / 3.369.37); (2) the repo canonizes `vendor/` in git and gitignores the
lock, so a lock bump is a no-op — the committed library code is what the scanner
sees; (3) the patched lib's own PHP ceiling (`<8.5`) excluded the dev box, so the
build *had* to run on the deploy PHP (8.2). Bonus: verifying the 9.8 RCE fix by
behavior (live `phar://` rejection), not by version number.
Source: ~/code/STRIDE/1_APPS/TAD/STATUS-2026-06-04-cb404e00.md;
  exec summary TIMOTHY_DOCS/2026-06-04_SBOP-7149_*; `claude --resume cb404e00-3bc8-453a-a0ed-cc179d2f7e69`
Status: idea

## dwm tabbed-patches: tmux-style keybinds + XEmbed st transparency   (2026-06-04)
Hook: Ctrl+b prefix via per-client `XGrabKey` + one-shot `XGrabKeyboard`
(guarding on `GrabSuccess`), and XEmbed `st` transparency via a 32-bit ARGB
visual across all 6 draw sites + premultiplied `baralpha`.
Source: branch `feat/tmux-keybinds-transparency`; spec/plan in
  ~/.local/src/.../docs/superpowers/; `claude --resume d05517fe-80d1-4aa5-bdea-bf5a1edc7e52`
Status: idea

## Disaster-recovery clone war story   (2026-06-02)
Hook: Resumable, Ctrl-C-safe LUKS+rsync DR clone for travel — the real-world
warts of cloning an encrypted root safely while unplugged.
Source: draft already started at
  ~/docs/superpowers/specs/2026-06-02-dr-article-warstory-draft.md;
  `claude --resume 0bd67ba9-1530-40f1-a50e-a2d534b37fa0`
Status: drafting

## reMEMBER: per-day capture tool reusing the suckless dmenu   (2026-05-28)
Hook: A timestamped per-day capture workflow (`~/reMEMBER/`) built by *reusing*
the suckless dmenu instead of a new UI — small-tools-composed, Aegix-friendly.
Source: `claude --resume e25cf972-d92a-4d5f-9de5-33898a333429`
  (gated on confirming Mod+R works post dwm-restart)
Status: idea
