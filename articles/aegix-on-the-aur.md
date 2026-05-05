# From `~/.local/src` to the AUR

If you run [Aegix](https://aegixlinux.org) — or you're an Arch / Artix tinkerer who likes the suckless stack — you can now `yay -S dwm-aegix-git` (or `st-aegix-git`, `dmenu-aegix-git`, `dwmblocks-aegix-git`) and pull down the exact builds I run on my own machine. This post is the short story of how that pipeline got built, and a couple of small gotchas worth knowing if you publish your own.

## The problem

I edit my suckless tools the obvious way: in `~/.local/src/{dwm,st,dmenu,dwmblocks}`, then `sudo make clean install`. That's the source of truth on this machine. Two things needed solving:

1. **Reflect those edits into the AEGIX monorepo** so the project's submodule pins stay current — without needing me to remember.
2. **Publish them to the AUR** so anyone running Arch or Artix can install Aegix's flavor without cloning, patching, and `make`-ing four repos.

Different problems, same starting point.

## Half one: the local sync

The reflection part is a single `post-commit` hook in each `~/.local/src/<tool>` repo. When I commit, the hook fast-forwards the corresponding submodule in `~/code/PROJECTS/AEGIX/<tool>` to the new SHA and stages the submodule pointer bump in the parent. That's it.

It does **not** push anywhere. I tried an earlier design that auto-pushed to GitHub, and it bit me the first time my local was behind the remote — the hook happily force-shoved stale state over newer commits. The lesson:

> Live on this machine is truth. The network is a manual gesture.

So now there's exactly one place automation touches: my local filesystem. `git push` stays in my fingers, where it belongs. The whole sync is ~150 lines of bash with a 28-assert test harness. Boring on purpose.

## Half two: the AUR side

The four packages are all `-git` flavor, which means the PKGBUILD doesn't need editing when I tweak `config.h`. The `pkgver()` function auto-resolves against GitHub HEAD on every build:

```bash
pkgver() {
  cd "$_pkgname"
  printf "r%s.%s" "$(git rev-list --count HEAD)" "$(git rev-parse --short HEAD)"
}
```

So my normal flow is now exactly two manual operations:

```bash
# 1. Edit + test live
vim ~/.local/src/dwm/config.h
cd ~/.local/src/dwm && sudo make clean install

# 2. Commit (hook reflects to AEGIX automatically)
git commit -am "feat: new keybinding"

# 3. When ready, publish
git push origin master
```

Next time anyone runs `yay -Syu`, AUR resolves the new HEAD and they get the rebuild. The PKGBUILD itself only needs touching for real packaging changes (new dep, license fix, build-system tweak).

## The flow

```
  ~/.local/src/<tool>/          ← edit + build + test
           │
           │ git commit
           ▼
  post-commit hook (local, no network)
           │
           └─► ~/code/PROJECTS/AEGIX/<tool>/   ← submodule advances
           
           │ git push            ← only manual network action
           ▼
  github.com/aegixlinux/<tool>
           │
           │ pkgver() resolves on yay -Syu
           ▼
  AUR users get fresh builds  ✨
```

Two manual git operations, four published packages.

## Two gotchas worth sharing

**1. AUR work-trees inside a parent repo.** I wanted `aur/<pkg>/PKGBUILD` to be tracked by the outer monorepo *and* by the AUR's own remote. Nested `.git` directories make Git refuse to track the inner files in the outer repo. The fix: hold each AUR package's `.git` outside its work-tree, in a sibling `aur/.aur-git/<pkg>/` dir, and run AUR-side git through a tiny wrapper:

```bash
#!/usr/bin/env bash
PKG="$1"; shift
export GIT_DIR="$HOME/AEGIX_AGENTIC/aur/.aur-git/$PKG"
export GIT_WORK_TREE="$HOME/AEGIX_AGENTIC/aur/$PKG"
exec git "$@"
```

Now `aur-git dwm-aegix-git push` does the right thing without confusing the parent repo.

**2. `st`'s `tic` runs at install time.** The stock `st` Makefile calls `tic -sx st.info` during `make install`, which writes to `/usr/share/terminfo` — fine on a real install, but inside makepkg's fakeroot it tries to write to the real filesystem and fails. The fix is a one-line `prepare()` step in the PKGBUILD:

```bash
prepare() {
  cd "$_pkgname"
  sed -i 's|tic -sx st.info|tic -sx -o "$(DESTDIR)/usr/share/terminfo" st.info|' Makefile
}
```

Both of these took longer to diagnose than to fix, which is the usual ratio.

## Why bother

Honestly? Mostly so I stop accidentally diverging between "the dwm I actually use" and "the dwm I publish." When the publishing is one `git push` away from the editor, there's no excuse for them to drift. And as a side effect, anyone curious about Aegix's stack can try a piece of it without committing to the whole distro.

If you want to peek: the four packages are on the AUR under `dwm-aegix-git`, `st-aegix-git`, `dmenu-aegix-git`, `dwmblocks-aegix-git`. The build pipeline lives at [github.com/aegixlinux](https://github.com/aegixlinux).
