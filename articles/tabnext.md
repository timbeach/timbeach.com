# tabnext — Open New Browser Tabs Next to Your Current One

![Pixel-art scene: a graveyard of Manifest V2 extensions with tombstones like "Open Tabs Next to Current — died", while a heart-eyed penguin rebuilds one at a workbench from a Manifest V3 blueprint. A display reads TAB COUNT: 42.](pix/tabnext-article-hero.png)

One day Brave greeted me with a gray banner: "This extension was turned off because it is no longer supported." *Open Tabs Next to Current* — an extension I'd used for so long I had forgotten it was an extension — was off, permanently, with a polite recommendation that I remove it.

Nothing was wrong with it. It did one thing perfectly: when you opened a new tab, it appeared next to the tab you were on instead of at the far end of the tab strip, somewhere past tab forty, at the end of the world. But it was written for Manifest V2, Chromium retired Manifest V2, and the author never ported it. That's the whole obituary. Multiply it by thousands of small, finished, single-purpose extensions and you have a quiet mass extinction that most people experienced as a random sprinkle of "no longer supported" banners.

Here's the thing though: an extension like this is about a hundred lines of JavaScript, requires zero permissions, and has no build step. If one you loved died in the MV2 purge, resurrecting it yourself is a genuinely great weekend-morning project. This is the story of mine — including the two places where the obvious implementation is wrong, because those are the parts worth writing down.

## The ten-line version that almost works

A Chromium extension needs two files. A manifest:

```json
{
  "manifest_version": 3,
  "name": "tabnext",
  "version": "1.0.0",
  "background": { "service_worker": "background.js" },
  "action": { "default_title": "tabnext" }
}
```

Note what's missing: a `permissions` key. Moving tabs, counting tabs, and drawing a badge need no permissions at all, because none of it reads URLs, titles, or history. The extensions page literally says "requires no special permissions." In an ecosystem where a wallpaper extension wants to Read Your Browsing History, I find that deeply satisfying.

And the logic, which seems like it should be this:

```js
chrome.tabs.onCreated.addListener(async (tab) => {
  const [active] = await chrome.tabs.query({
    active: true,
    windowId: tab.windowId,
  });
  chrome.tabs.move(tab.id, { index: active.index + 1 });
});
```

New tab appears → find the active tab → move the new tab next to it. This compiles, loads, and even works — for middle-clicked links. Then you press Ctrl+T and nothing happens, and you have found surprise number one.

## Surprise one: new tabs are born active

A tab you open in the foreground — Ctrl+T, the new-tab button — is *already the active tab* by the time `tabs.onCreated` fires. So the query for "the active tab" returns the newborn itself, and moving a tab to its own index plus one is a no-op wearing a trench coat.

The fix is to ask a different question when that happens: not "which tab is active?" but "which tab was I *just using*?" Chromium tracks `lastAccessed` on every tab (no permission needed for that either), so the previously-used tab is simply the highest `lastAccessed` among the window's other tabs:

```js
async function referenceTab(newTab) {
  const [active] = await chrome.tabs.query({
    active: true,
    windowId: newTab.windowId,
  });
  if (active && active.id !== newTab.id) return active;

  const others = (await chrome.tabs.query({ windowId: newTab.windowId }))
    .filter((t) => t.id !== newTab.id);
  if (others.length === 0) return null;
  return others.reduce((a, b) =>
    (a.lastAccessed ?? 0) >= (b.lastAccessed ?? 0) ? a : b
  );
}
```

With that, everything lands where it should: Ctrl+T, middle-clicks, links opened from other programs. I loaded it in Brave, ran through my test checklist, and everything passed except one line item. Which brings us to the good bug.

## Surprise two: session restore is also "opening tabs"

I'm a heavy tab-groups user. After I quit Brave and restored my session from History, a bunch of tabs had *escaped their groups* and were scattered around the strip. If you want to lose a tab-group person as a user, this is how you do it in one move.

The root cause turned out to be three separate facts stacked on top of each other:

**Fact one:** `tabs.onCreated` fires for *every* tab creation — including the dozens the browser creates itself during a session restore. To an extension, a restore looks like someone opening forty tabs very fast.

**Fact two:** when `onCreated` fires, the tab's group membership *isn't set yet*. The documentation says so plainly. A restored tab that belongs to a group looks ungrouped for the first instant of its life, so "skip grouped tabs" filters catch nothing.

**Fact three:** `tabs.move` to an index outside a group's span silently strips the tab's group membership. So every restored tab my extension "helpfully" repositioned was also being ripped out of its group.

My first defense — ignore tabs created within two seconds of their window being created — was the right idea with the wrong clock. A real restore keeps creating tabs well past any fixed timer, and a restore into an *already-open* window never trips a window-age check at all.

The fix that stuck has two parts. First, the quiet period extends itself: a new window starts two seconds of quiet, and any tab created during quiet — or within 300 ms of the previous creation, a cadence only the browser can produce — extends it another second. A restore burst shields itself for exactly as long as it lasts:

```js
function inQuietPeriod(windowId) {
  const now = Date.now();
  const prev = lastCreatedAt.get(windowId) ?? 0;
  lastCreatedAt.set(windowId, now);
  const quiet = now < (quietUntil.get(windowId) ?? 0)
    || now - prev < 300;
  if (quiet) quietUntil.set(windowId, now + 1000);
  return quiet;
}
```

Second, the move is no longer instant. The extension waits 150 milliseconds, re-fetches the tab, and leaves it alone if it has meanwhile joined a group, been closed, or been followed by more creations. That settle-then-verify step is what closes fact two for good — by the time we act, the browser has finished saying what the tab actually is. The cost is a barely-visible hop as your new tab moves from the end of the strip into place. I'll take it.

There's even a bonus that falls out of Chromium's own move semantics: `tabs.move` to an index *between* grouped tabs joins the group. So Ctrl+T while you're inside a tab group opens the new tab in that group, right next to you — which is exactly what a groups person wants, and I never wrote a line of code for it.

## The tab counter, almost for free

Since the extension now had a toolbar icon doing nothing, I gave it a job: a live badge with the total number of open tabs. This part is as easy as it looks:

```js
async function updateBadge() {
  const tabs = await chrome.tabs.query({});
  await chrome.action.setBadgeText({ text: String(tabs.length) });
}

chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);
```

![tabnext store card: mock tab strip showing a new tab opening right of the current tab, penguin icon with a live count badge](pix/tabnext-store-card.png)

No judgment. Just a number. (You can pretend it's judgment.)

## The part that used to be the hard part

The whole thing is 105 lines of JavaScript and a manifest. No framework, no bundler, no `node_modules` — the repo *is* the extension. You load it from `brave://extensions` (or `chrome://extensions`) by flipping on Developer mode and pointing Load Unpacked at the directory. One event-driven service worker that sleeps between tab events; nothing resident, nothing configurable, nothing phoning home.

It's called **tabnext**, it's MIT-licensed, and the code is short enough to read in full before you install it — which, for browser extensions, should be a feature we demand more often:

**https://github.com/timbeach/tabnext**

If your own favorite extension died in the MV2 purge, check how big it actually was. The odds are good it was a hundred lines of somebody's weekend, and the platform underneath — `chrome.tabs`, `chrome.action`, a JSON manifest — is still right there, waiting for yours.
