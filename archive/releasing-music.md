# Releasing Music as a Human Being: From WAV Files to Spotify

You finished the music. Two tracks, mixed and mastered. You have album art. You have no idea what comes next.

You are the songwriter. You are the producer. No label, no manager, no A&R guy who "believes in your vision." Just you and some WAV files. The goal is simple: get these tracks onto Spotify so anyone with a phone can press play.

Turns out there is a surprisingly dense thicket of acronyms between you and that goal. PROs, ISRCs, UPCs, LUFS, the MLC. Each one is a small thing to learn, but nobody lays them all out in one place. This article does that. It is the checklist I wish I had before I started.


## The Checklist

Here is everything you need to do, in order. Each item links to a deep-dive section below.

1. **Register with a PRO** — ASCAP or BMI. This is how you get paid when your song is played.
2. **Register with the MLC** — Free. Collects a separate stream of royalties most indie artists miss entirely.
3. **Prepare your audio files** — Right format, right sample rate, right loudness.
4. **Prepare your album art** — 3000x3000, square, sRGB. No exceptions.
5. **Decide your release strategy** — One single with two tracks? Two separate singles? It matters.
6. **Choose a distributor** — The company that actually puts your music on Spotify.
7. **Fill out your metadata** — Title, artist name, genre, credits. Get it right the first time.
8. **Set a release date** — 4-6 weeks out. Not tomorrow.
9. **Pitch to Spotify editorial playlists** — Free, built into Spotify for Artists, but time-sensitive.
10. **Register your copyright** — $45-65. Legal protection you will be glad you have.
11. **(Optional) Set up admin publishing** — Captures international royalties you would otherwise never see.

Now let's walk through each one.

---


## 1. Register with a PRO

A PRO (Performance Rights Organization) collects **performance royalties** on your behalf. Every time your song is streamed on Spotify, played on the radio, performed live at a venue, or piped through the speakers at a coffee shop, a performance royalty is generated. Without a PRO, nobody is collecting that money for you. It just doesn't arrive.

You have two real options: **ASCAP** and **BMI**. (SESAC exists but is invite-only — skip it.)

| | ASCAP | BMI |
|---|---|---|
| Writer registration | $50 one-time | Free |
| Publisher registration | $50 one-time | $150 one-time |
| Payment frequency | Quarterly | Quarterly |
| Payment lag | ~6.5 months | ~5.5 months |
| Contract term | 1 year | 2 years |

If you are only registering as a **songwriter** (not setting up a separate publisher entity), BMI is free and ASCAP costs $50. BMI wins on cost.

If you are registering as **both writer and publisher** (a one-person operation where you wear both hats), ASCAP charges $100 total versus BMI's $150. ASCAP wins on combined cost.

Both are reputable. Both collect from the same pool of performance income. The practical difference is minimal for most independent artists. Pick one and move on.

**You cannot join both.** One PRO per songwriter. Choose one.

When you register, you will receive an **IPI number** — a unique international identifier for you as a songwriter. You will need this later when registering your works with the MLC and with your distributor. It is public information. Share it freely with collaborators.

**Important:** Register your songs (called "works") in your PRO's portal as soon as they exist. Performance royalties do not collect retroactively for streams that happened before the work was registered. Register early.


## 2. Register with the MLC

The **MLC (Mechanical Licensing Collective)** collects **mechanical royalties** — a completely separate income stream from the performance royalties your PRO handles.

A mechanical royalty is generated every time your *composition* is reproduced: streamed on Spotify, downloaded on iTunes, pressed onto vinyl. The word "mechanical" is a relic from the player piano era, but the money is real.

Here is the thing most independent artists miss: roughly **15% of US streaming songwriter income goes entirely unclaimed** because artists are not registered with the MLC. This is real money sitting in a pool with nobody's name on it.

The MLC is:
- **Free to register** — no fees, no commission, no percentage taken
- **100% of royalties kept** — they take nothing
- Open to **self-administered songwriters** — you do not need a publisher
- Pays out **monthly**

Go to [themlc.com](https://www.themlc.com), create a free account as a self-administered songwriter, register each of your songs, and link your bank account. That's it. Do this before your music goes live.

The MLC only covers US digital mechanical royalties. International mechanicals require either an admin publishing service or direct registration with foreign collection societies — more on that in section 11.


## 3. Prepare Your Audio Files

Your distributor will deliver your audio to Spotify. Here is what to hand them:

| Parameter | Requirement |
|---|---|
| Format | FLAC preferred, WAV accepted |
| Sample rate | 44.1 kHz minimum — submit at your native mastering rate |
| Bit depth | 24-bit preferred, 16-bit minimum |
| Channels | Stereo only |
| Loudness target | -14 LUFS integrated |
| True peak ceiling | -1 dBTP |

A few notes on loudness: Spotify applies **loudness normalization** during playback, targeting **-14 LUFS integrated** (the ITU-R BS.1770 standard). Your master is not altered — Spotify just adjusts the playback volume. If your master is louder than -14 LUFS, the volume gets turned down. If it is quieter, it gets turned up.

The practical implication: **do not brick-wall your master for streaming.** A master slammed to -8 LUFS will be turned down to -14 LUFS anyway, and it will sound worse than a dynamic master that was already sitting at -14 LUFS. Master for dynamics, not for volume.

The **-1 dBTP true peak ceiling** prevents inter-sample distortion during Spotify's lossy transcoding to Ogg Vorbis. If your master is significantly louder than -14 LUFS, use **-2 dBTP** instead for extra headroom.

Submit at your **native mastering resolution**. If you mastered at 48 kHz / 24-bit, submit that. Do not upsample a 44.1 kHz master to 96 kHz — it adds nothing. Do not downsample a 24-bit master to 16-bit — let Spotify handle the conversion.


## 4. Prepare Your Album Art

| Parameter | Requirement |
|---|---|
| Dimensions | 3000 x 3000 px recommended (640 min, 10000 max) |
| Aspect ratio | 1:1 (square) — mandatory |
| Format | JPG or PNG |
| Color space | sRGB, 24-bit color |
| Max file size | Varies by distributor — 3000x3000 JPG is always fine |

Do not upscale a smaller image to hit 3000x3000. Spotify explicitly prohibits this and the blurriness is obvious. If your art was created at a lower resolution, you need new art.

Your cover art **cannot contain**:
- URLs, email addresses, or social media handles
- Phone numbers or contact information
- References to pricing or retail
- Explicit imagery (unless the release is flagged explicit)

The words "Single" or "EP" should **not** appear in your cover art or release title. Spotify classifies releases automatically based on track count and duration — more on that next.


## 5. Decide Your Release Strategy

Spotify classifies releases automatically. You cannot override it. The rules:

| Release Type | Tracks | Duration Rules |
|---|---|---|
| Single | 1-3 | All tracks under 10 min, total under 30 min |
| EP | 4-6 | Total under 30 min |
| EP | 1-3 | At least one track is 10+ min |
| Album | 7+ | Any duration |
| Album | Any | Total over 30 min |

With two tracks both under 10 minutes, you are firmly in **Single** territory regardless of whether you release them together or separately.

The strategic question: **one 2-track single, or two separate singles?**

**Two separate singles:**
- Two release dates = two moments of algorithmic visibility
- Each release gets its own pitch to Spotify's editorial playlist team
- More "release events" means more data points in Spotify's recommendation engine
- Stagger them 4-6 weeks apart for sustained presence

**One 2-track single:**
- Simpler — one upload, one metadata entry, done
- Makes sense if the tracks are thematically linked (A-side / B-side feel)
- Listeners get both tracks at once

For most independent artists releasing their first music, **two separate singles** is the stronger move. Each release is a chance to be discovered. You want to maximize those chances.


## 6. Choose a Distributor

A distributor is the company that takes your audio and metadata and delivers it to Spotify (and Apple Music, Tidal, Amazon Music, YouTube Music, and dozens of other platforms). You cannot upload directly to Spotify. You need a middleman.

| Distributor | Pricing | You Keep | Time to Spotify | Notable |
|---|---|---|---|---|
| DistroKid | $24.99/yr (unlimited) | 100% | 1-5 days | Fastest processing |
| CD Baby | $9.99/single (one-time) | 91% | 1-14 days | Pay once, stays forever |
| TuneCore | $29.99/yr (unlimited) | 100% | 1-7 days | Publishing admin available |
| Amuse | $23.99/yr (unlimited) | 100% | 1-7 days | Mobile-first platform |
| LANDR | $23.99/yr or $9/single | 100% while subscribed | 3-7 days | Integrated AI mastering |

The core tradeoff: **annual subscription vs. per-release fee.**

**DistroKid** ($24.99/year, unlimited uploads, 100% royalties) is the default recommendation if you plan to release music regularly. It is the fastest distributor and the most popular among independents. The catch: if you stop paying, your music comes down.

**CD Baby** ($9.99 per single, one-time, stays up forever) makes sense if you release rarely. The catch: they take a **permanent 9% commission** on all revenue from that release, forever. On a successful release, that 9% adds up quickly.

**TuneCore** is a solid middle ground with optional publishing administration built in.

All of these distributors will assign your **ISRC codes** (one per track) and **UPC code** (one per release) automatically and for free. You do not need to purchase these separately.


## 7. Fill Out Your Metadata

When you upload to your distributor, you will fill out metadata fields. Get these right — they are hard to change after release and affect how your music is found and credited.

| Field | What It Is | Notes |
|---|---|---|
| Release title | Name of the single/EP/album | Do not include "Single" or "EP" |
| Track title(s) | Name of each song | Exact spelling matters |
| Primary artist | Your artist name | Must be consistent across releases |
| Genre | Primary genre | Pick one. You can usually add a sub-genre. |
| Release date | When it goes live | YYYY-MM-DD format. Set 4-6 weeks out. |
| Explicit | Clean or Explicit | Per track |
| Language | Lyrics language | Required even for instrumentals (pick "English" if unsure) |
| ISRC | Per-track identifier | Distributor assigns this free |
| UPC | Per-release barcode | Distributor assigns this free |
| P-line | Sound recording copyright | "2026 Your Name" |
| C-line | Composition copyright | "2026 Your Name" |
| Label | Your label name | "Self-Released" or whatever you want |
| Songwriter | Composition credits | Your legal name |
| Producer | Production credits | Your legal name (or artist name) |

The **ISRC** (International Standard Recording Code) permanently identifies a specific recording. One per track. If you re-record or remix the track later, the new recording gets a new ISRC. The original keeps its code forever.

The **UPC** (Universal Product Code) is the barcode for the release as a product. One per release, regardless of track count.

Your distributor handles both of these. You do not need to think about them unless you want to own your own registrant codes for portability (see [usisrc.org](https://usisrc.org) — $95 one-time if you want this).


## 8. Set a Release Date

Do not set your release date for tomorrow. Here is why:

| Goal | Lead Time |
|---|---|
| Technical minimum (music goes live) | 3-5 business days |
| Minimum for Spotify playlist pitching | 7 days |
| Recommended | 4-6 weeks |
| Full promotional campaign | 3 months |

The critical reason to submit early: **Spotify editorial playlist pitching.**

Once your distributor delivers your release, it will appear in **Spotify for Artists** as an upcoming release. From there, you can pitch **one unreleased track** to Spotify's editorial team for playlist consideration. This pitch must be submitted **at least 7 days before your release date** — and the earlier the better.

You cannot pitch after the song goes live. The window only exists before release. This alone is reason enough to submit your music 4-6 weeks before you want it available.

Set your release date. Submit your music. Then pitch while you wait.


## 9. Pitch to Spotify Editorial Playlists

This is free. It is built into Spotify for Artists. Most independent artists either do not know it exists or forget to do it.

Here is the process:
1. Your distributor delivers your release to Spotify
2. The release appears as "upcoming" in your Spotify for Artists dashboard
3. You select one track from the release to pitch
4. You fill out a short form: genre, mood, instruments, story behind the song
5. Submit at least 7 days before release (earlier = better)
6. Wait

There is no guarantee of placement. Most pitches do not result in editorial playlist adds. But the pitch is free, it takes five minutes, and the upside is enormous. A single editorial playlist placement can generate tens of thousands of streams. Do not skip this step.

If you do not yet have a **Spotify for Artists** account, claim your artist profile at [artists.spotify.com](https://artists.spotify.com) after your first release is delivered by your distributor.


## 10. Register Your Copyright

Copyright exists automatically the moment you record your song. You do not need to register it to own it. But **registering with the US Copyright Office** gives you legal tools you do not have otherwise:

- You **cannot file a copyright infringement lawsuit** without registration
- If registered **before** infringement occurs, you can claim **statutory damages** (up to $150,000 per work for willful infringement) and **attorney's fees**
- Without registration, you can only sue for actual damages — which are hard to prove and usually small

For a solo artist who wrote and produced everything, file **Form SR** (Sound Recording). This single form covers both the sound recording and the underlying composition when the same person owns both.

| | Detail |
|---|---|
| Where | [copyright.gov](https://www.copyright.gov/registration/) (eCO online system) |
| Cost | $45 (single author, single work) or $65 (standard) |
| Processing time | Several months — but your registration date is the date you *file* |
| What it covers | Both your recording and your composition (Form SR, same owner) |

$45 for legal protection on a song you spent months creating. Do it.


## 11. (Optional) Admin Publishing

If you have done steps 1-10, you are collecting:
- **Performance royalties** via your PRO (ASCAP or BMI)
- **US mechanical royalties** via the MLC
- **Streaming/download revenue** via your distributor

The gap: **international mechanical royalties.** When someone in Germany or Japan streams your song, a mechanical royalty is generated in that country. Your PRO and the MLC do not collect those. That money goes to the local collection society in that territory and sits there unless someone claims it on your behalf.

An **admin publishing service** (not a traditional publisher — no ownership transfer) registers your works with collection societies worldwide and collects that international income for you.

| Service | Setup Cost | Commission |
|---|---|---|
| Songtrust | ~$100 | 15% performance / 20% mechanicals |
| CD Baby Pro | Per-release fee | ~15% |
| TuneCore Publishing | Annual fee | ~15% |

Is it worth it? Depends on your international stream volume. If 90% of your listeners are in the US, the MLC already handles your mechanicals for free. If you start seeing significant international streams, an admin publisher captures income you would otherwise leave on the table.

For a first release, this is optional. Revisit it after you have streaming data to look at.

---

## The Short Version

You made the music. Everything else is paperwork. Here it is again, compressed:

1. **PRO** — Join BMI (free) or ASCAP ($50). Register your songs.
2. **MLC** — Register at themlc.com (free). Do not skip this.
3. **Audio** — FLAC or WAV, 44.1+ kHz, 24-bit, -14 LUFS, -1 dBTP.
4. **Art** — 3000x3000, square, JPG/PNG, sRGB.
5. **Strategy** — Two separate singles beats one 2-track single for algorithmic reach.
6. **Distributor** — DistroKid ($25/yr, 100%) or CD Baby ($10, keeps 9%).
7. **Metadata** — Artist name, credits, explicit flag. Distributor handles ISRC/UPC.
8. **Release date** — Set 4-6 weeks out. Submit early.
9. **Pitch** — Use Spotify for Artists to pitch one track. Free. Do it.
10. **Copyright** — File Form SR at copyright.gov. $45.
11. **Admin publishing** — Optional. Revisit after you have data.

Now go release something.
