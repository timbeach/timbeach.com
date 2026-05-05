# Releasing Music Article - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Write and publish the "Releasing Music as a Human Being" article on timbeach.com.

**Architecture:** Single markdown article file + articles.json registry entry. Content follows the "checklist + deep dives" structure from the design doc.

**Tech Stack:** Markdown, JSON, bash (deploy.sh)

---

### Task 1: Register the article in articles.json

**Files:**
- Modify: `articles/articles.json`

**Step 1: Add the new article entry**

Add as the first entry in articles.json (newest article goes on top):

```json
"releasing-music.md": {
  "title": "Releasing Music as a Human Being: From WAV Files to Spotify",
  "date": "2026-03-01",
  "tags": ["music", "tutorial", "indie", "spotify"],
  "emoji": "🎵"
},
```

**Step 2: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('articles/articles.json'))"`
Expected: No output (valid JSON)

**Step 3: Commit**

```bash
git add articles/articles.json
git commit -m "feat: register releasing-music article in articles.json"
```

---

### Task 2: Write the article intro and checklist

**Files:**
- Create: `articles/releasing-music.md`

**Step 1: Write the title, intro paragraph, and complete TL;DR checklist**

The intro should:
- Set the premise: you have WAV files and album art, nothing else
- Establish the voice: practical, technical, no industry jargon without explanation
- Present the full numbered checklist (11 items) as a quick reference

The checklist items (in order):
1. Register with a PRO (BMI or ASCAP)
2. Register with the MLC (free)
3. Prepare your audio files
4. Prepare your album art
5. Decide your release strategy (single vs two singles)
6. Choose a distributor
7. Upload and fill out metadata
8. Set a release date (4-6 weeks out)
9. Pitch to Spotify editorial playlists
10. Register your copyright
11. (Optional) Admin publishing for international royalties

**Step 2: Verify the file renders**

Open in browser or check markdown renders correctly.

**Step 3: Commit**

```bash
git add articles/releasing-music.md
git commit -m "feat: add releasing-music article intro and checklist"
```

---

### Task 3: Write deep dive sections 1-2 (PRO + MLC)

**Files:**
- Modify: `articles/releasing-music.md`

**Step 1: Write Section 1 - PRO Registration**

Cover:
- What performance royalties are (1-2 sentences)
- Why you need a PRO to collect them
- ASCAP vs BMI comparison table:

| | ASCAP | BMI |
|---|---|---|
| Writer fee | $50 one-time | Free |
| Publisher fee | $50 one-time | $150 |
| Payment frequency | Quarterly | Quarterly |
| Payment lag | ~6.5 months | ~5.5 months |
| Contract term | 1 year | 2 years |

- SESAC: invite-only, skip it
- IPI number: assigned automatically on registration, share it freely
- Practical recommendation

**Step 2: Write Section 2 - The MLC**

Cover:
- What mechanical royalties are (distinct from performance royalties)
- The MLC: free, no commission, 100% kept
- ~15% of streaming songwriter income goes unclaimed
- Registration steps at themlc.com

**Step 3: Commit**

```bash
git add articles/releasing-music.md
git commit -m "feat: add PRO and MLC deep dive sections"
```

---

### Task 4: Write deep dive sections 3-4 (Audio + Art specs)

**Files:**
- Modify: `articles/releasing-music.md`

**Step 1: Write Section 3 - Audio File Specs**

Cover with a specs table:

| Parameter | Requirement |
|---|---|
| Format | FLAC preferred, WAV accepted |
| Sample rate | 44.1 kHz minimum, native rate preferred |
| Bit depth | 24-bit preferred, 16-bit minimum |
| Channels | Stereo only |
| Loudness target | -14 LUFS integrated |
| True peak ceiling | -1 dBTP |

- Explain Spotify normalizes playback to -14 LUFS
- "Don't brick-wall master for streaming"
- Submit at your native mastering resolution, don't upsample

**Step 2: Write Section 4 - Album Art Specs**

Cover with a specs table:

| Parameter | Requirement |
|---|---|
| Dimensions | 3000 x 3000 px recommended (640 min, 10000 max) |
| Aspect ratio | 1:1 (square) mandatory |
| Format | JPG or PNG |
| Color space | sRGB, 24-bit |
| Don't | Upscale, include URLs/contact info, include pricing |

**Step 3: Commit**

```bash
git add articles/releasing-music.md
git commit -m "feat: add audio and album art specs sections"
```

---

### Task 5: Write deep dive section 5 (Single vs EP vs Album)

**Files:**
- Modify: `articles/releasing-music.md`

**Step 1: Write Section 5 - Release Strategy**

Cover:
- Spotify classification rules table:

| Release Type | Tracks | Duration Rules |
|---|---|---|
| Single | 1-3 | All under 10 min, total under 30 min |
| EP | 4-6 | Total under 30 min |
| EP | 1-3 | At least one track 10+ min |
| Album | 7+ | Any duration |
| Album | Any | Total over 30 min |

- Two tracks = Single by Spotify's rules
- Strategy discussion: release as two separate singles vs one 2-track single
- Two singles = two "release events" = more algorithmic surface area
- One single = simpler, better if tracks are thematically paired

**Step 2: Commit**

```bash
git add articles/releasing-music.md
git commit -m "feat: add release strategy section"
```

---

### Task 6: Write deep dive section 6 (Distributor comparison)

**Files:**
- Modify: `articles/releasing-music.md`

**Step 1: Write Section 6 - Distributor Comparison**

Full comparison table:

| Distributor | Pricing | You Keep | Time to Spotify | Notable |
|---|---|---|---|---|
| DistroKid | $24.99/yr (unlimited) | 100% | 1-5 days | Fastest, annual sub |
| CD Baby | $9.99/single (one-time) | 91% | 1-14 days | Pay once, stays forever |
| TuneCore | $29.99/yr (unlimited) | 100% | 1-7 days | Publishing admin available |
| Amuse | $23.99/yr (unlimited) | 100% | 1-7 days | Mobile-first |
| LANDR | $23.99/yr or $9/single | 100% (while subscribed) | 3-7 days | Integrated mastering |

- Key decision: annual sub vs per-release
- If you release often: DistroKid
- If you release rarely: CD Baby
- Note: CD Baby's 9% commission is permanent and compounds on successful releases

**Step 2: Commit**

```bash
git add articles/releasing-music.md
git commit -m "feat: add distributor comparison section"
```

---

### Task 7: Write deep dive sections 7-8 (Metadata + Timeline)

**Files:**
- Modify: `articles/releasing-music.md`

**Step 1: Write Section 7 - Metadata**

Cover:
- Required fields table (title, artist, genre, release date, ISRC, UPC, explicit flag, language)
- ISRC: one per track, distributor assigns free, 12-character code
- UPC: one per release, distributor assigns free, barcode
- P-line: sound recording copyright ("2026 Your Name")
- C-line: composition copyright
- Label name: "Self-Released" or whatever you want
- Songwriter/producer credits

**Step 2: Write Section 8 - Timeline & Release Strategy**

Cover:
- Timeline table:

| Goal | Lead Time |
|---|---|
| Technical minimum | 3-5 business days |
| Spotify minimum for pitching | 7 days |
| Recommended | 4-6 weeks |
| Full campaign | 3 months |

- Spotify editorial playlist pitching: done in Spotify for Artists, one unreleased track per release, must pitch 7+ days before release
- This is why you submit early

**Step 3: Commit**

```bash
git add articles/releasing-music.md
git commit -m "feat: add metadata and timeline sections"
```

---

### Task 8: Write deep dive sections 9-10 + closing (Copyright + Publishing + wrap-up)

**Files:**
- Modify: `articles/releasing-music.md`

**Step 1: Write Section 9 - Copyright Registration**

Cover:
- Copyright exists automatically, but registration provides legal teeth
- SR form covers both recording and composition when you own both
- eCO online: $45 (single author/work) or $65 (standard)
- Filing date = registration date (matters for statutory damages eligibility)
- Statutory damages: up to $150k per work for willful infringement

**Step 2: Write Section 10 - Admin Publishing (Optional)**

Cover:
- Traditional publisher: takes ownership. Admin publisher: just collects, no ownership transfer
- Songtrust: ~$100 setup + 15% commission
- MLC handles US mechanicals for free
- Admin publishing adds international mechanical collection
- Worth it if you expect significant international streams

**Step 3: Write the closing**

Brief, punchy: "You made the music. The rest is paperwork. Go fill it out."

**Step 4: Commit**

```bash
git add articles/releasing-music.md
git commit -m "feat: add copyright, publishing, and closing sections"
```

---

### Task 9: Final review and deploy

**Files:**
- Review: `articles/releasing-music.md`
- Review: `articles/articles.json`

**Step 1: Review full article for accuracy and flow**

Read through the entire article. Check:
- All tables render correctly in the site's markdown parser
- No broken links or formatting issues
- Checklist numbers match deep-dive section numbers
- Tone is consistent (practical, direct, no fluff)

**Step 2: Test locally**

Open `index.html` in a browser and:
- Run `ls` in the terminal to see the new article listed
- Run `cat releasing-music.md` to verify it renders
- Check that tables, headers, and formatting look correct

**Step 3: Deploy**

Run: `./deploy.sh`

**Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: final article polish and deploy"
```
