# The Synapse Application + Sound/Consciousness Mission — Design

**Date:** 2026-07-28
**Session:** 63510343 ("conference talk")
**Status:** Application text approved in-session; mission sub-projects tracked in beads.

## Context

Timothy is applying to The Synapse (thesynapse.co) — Oct 9–11 2026, San Diego,
organized by Applied Love Labs, 100 attendees, fully covered, application
deadline **July 31 2026**. Mason built the site; Mason is also presenting
Ionosphere research at TSC around the same window. The application is the first
gate of a larger mission: an RNG-driven sound-bath practice (Gut Lens ×
Ionosphere) that could grow into future ACORN/TSC contributions.

## Part 1 — Final application text

| Field | Value |
|---|---|
| Contribute to program? | Yes |
| Full name | Timothy Beach |
| Pronouns | he / him / they |
| Email | beachtimothyd@gmail.com |
| City / State / Country | Kingsport, Tennessee, USA |
| Affiliation | Independent |
| Gender | Male |
| How heard | Mason Borchard |
| Directory consent | Yes |
| Community guidelines | Agree |

### Short bio (71 words)

Builder first. I maintain Aegix Linux, a distro built on the suckless
philosophy — computing as a conscious practice rather than a consumption habit.
I write about sound, randomness, and attention at timbeach.com, and compose as
Gut Lens. I'm an engineering collaborator on the Ionosphere Project, which
probes mind–matter questions with true random number generators, light, sound,
and honest statistics. Current obsession: what a room full of people can hear
inside randomness.

### Why this gathering, and what you bring (245 words)

I'm a builder among academics in the consciousness world — a systems engineer,
Linux distro author, and sound artist who ended up doing serious research
because the questions wouldn't leave me alone. Over the past year I've
collaborated on the Ionosphere Project: art installations whose light and sound
are driven live by true random number generators, wrapped in genuinely rigorous
statistics — sealed intention windows, PRNG control arms, pre-registered
analyses. I came for the wonder and stayed for the rigor; I now believe each is
worthless without the other, and that conviction is what draws me here. The
Synapse is the first gathering I've seen designed to hold both at once.

What I'd bring to the program: an RNG sound bath. As Gut Lens I compose drone
music; with Ionosphere's engine I can let a random number generator modulate it
in real time — pentatonic events triggered by statistical deviation, key
modulations walking the circle of fifths when the stream goes strange. The room
lies down, and together we listen to randomness itself — while the statistics
are honestly displayed and honestly interpreted afterward. An earlier version
of this moved the room at February's ACORN symposium; this one goes further.
It's embodied practice, demonstration, and provocation, built to complement —
not repeat — the Ionosphere research presented at TSC.

I also bring the perspective of someone who builds his own tools — my own Linux
distribution, my own publishing stack, my own instruments — and who thinks
tool-building is itself a contemplative practice.

### Uplift women's ideas and plans (237 words)

The most concrete answer is the Ionosphere Project. It's women-led research,
and my role is to amplify that leadership rather than redirect it: I contribute
engineering — infrastructure, statistics tooling, hardware deployments like the
192-LED chandelier — in service of Dani's and Mason's research direction, and I
plan to deepen that collaboration substantially over the next year. When the
work is presented, my job is to make their ideas more buildable, more testable,
and more credible, not more mine.

At home, I'm partnered with a woman whose plans and ideas I back the same way —
with my time and my skills, treating her ambitions as projects we resource
seriously rather than dreams we talk about.

And honestly, this question touches something older than any project. I've been
a feminine man my whole life. As a teenager, nearly all my closest friends were
women; the perspectives that formed me were mostly women's perspectives. Every
tattoo on my body came from a woman artist — not by policy, but because when I
look for people whose vision I trust on my own skin, that's who I keep finding.
I'm most comfortable, and most honest, in rooms where women are setting the
tone. So "uplifting women's ideas" rarely feels to me like a deliberate
practice; it feels like paying forward the way I was actually raised,
befriended, inked, and taught — and choosing collaborations, like this one,
where that flow is the natural direction.

### What's been missing from other gatherings (92 words)

Most gatherings I attend make me choose a self. Engineering conferences have
rigor but treat wonder as unserious; consciousness spaces have wonder but
sometimes flinch from statistics. And in research circles I'm the builder among
academics — present, useful, slightly other. I'm hoping for a room that wants
the whole stack at once: someone who compiles his own operating system,
composes drone music, and cares deeply about pre-registered analyses — and
treats that combination as normal. Working sessions instead of received talks.
Rigor and wonder in the same conversation, ideally in the same sentence.

### Notes / guardrails observed

- Does NOT cite the voided NYE clustering numbers (beads q6e/kv5/8hz in
  Mason's workspace).
- Does not mention kbot (real-money trading — needs Mason/Dani sign-off before
  any public mention).
- No pronouns used for Mason or Dani in the text (Mason is they/them).
- ACORN proof-point: the sound piece that "moved the room" at ACORN Feb 2026
  was designed on an old Ableton version running on Dani's laptop.

## Part 2 — The mission (sub-projects, tracked in beads)

1. **Submit the Synapse application** — deadline July 31 2026. (P0)
2. **Buy a TRNG** — recommended: ubld.it **TrueRNGpro V2** (~$100–130,
   ubld.it/products/truerngprov2, also on Amazon). Dual shielded avalanche
   noise generators, aluminum enclosure, per-generator monitoring LEDs,
   3.2 Mbit/s, and **raw-mode output** — the raw tap matters because of the
   whitening problem (TrueRNG v3's Galois-field mixer destroys first-order
   bias; raw mode is the only way to even look). (P1)
3. **Study + expand the MIDI drone scheme** — `README_Drone.md`,
   `Desk_MidiDrone.py`, `midi_handle.py` in the ionosphere repo. Current
   design: 200 bits/s, |X−100|>13 → pentatonic note, |X−100|>25 → circle-of-
   fifths modulation, cumulative z tracked. Expansion = the Gut Lens sound-bath
   engine for Synapse. (P1)
4. **Local PRNG borchard experiment** — run the borchard lighting scheme
   locally with `RANDOM_SRC='prng'` + the embedded matplotlib visualizer (both
   already exist in `utils/rng_manager.py` / the runner), then couple in the
   MIDI flow. Doubles as the sham/control arm. (P2)
5. **Private mobile network** — hardware for a dedicated hotspot so Timothy,
   Mason, and Dani's machines + lighting installations + TRNGs share one
   private LAN with internet egress via Timothy's existing data SIM. Needs a
   hardware pick (likely a cellular router with LAN, e.g. GL.iNet class —
   research pending). (P2)
6. **Sound bath rehearsal for Oct 9–11** — blocked by #2 and #3. Fallback
   floor: the Ableton-on-laptop setup that worked at ACORN. (P1)
