# How Ham Radio Repeaters Work

![A mountaintop ham radio repeater relaying signals between handheld radios across a valley](pix/repeaters.png)

A five-watt handheld radio is a small miracle — a complete transmitter and receiver you can clip to your belt. It is also, on its own, a bit of a disappointment. In town, two handhelds might manage a mile or two before buildings and hills eat the signal. Yet that same little radio can carry a conversation across an entire city and three counties beyond it.

The difference is a machine most people have never heard of: the repeater. And the best way I've found to explain one — tested on a ten-year-old, approved for all ages — is to think of it as a very powerful, very helpful robot radio living on top of a mountain.

Ours lives on Bays Mountain, about 2,600 feet above Kingsport, Tennessee. Its name is W4TRC. Let's meet it.

## The problem: your signal dies at the horizon

The bands handheld radios use travel in essentially straight lines. They don't bend over ridges or follow the curve of the Earth. If your antenna can't "see" the other antenna, the conversation is over — and from chest height on a sidewalk, you can't see very far at all. Every building and hill in between takes a bite out of what's left.

Here's the part that surprises people: more power barely helps. Doubling your wattage doesn't double your range — it nudges it. The thing that actually wins is height.

## The fix: a robot radio on the mountain

If height wins, the answer is obvious: put a radio on the highest ground around and let it do the talking for you.

That's a repeater — an automated station on a mountaintop or tower that listens for faint signals and instantly re-broadcasts them from its spectacular location, with more power and a far better antenna than you'll ever hold. Your five watts only has to make one hop: up to the mountain. The robot shouts the rest.

Two handhelds that can't hear each other across town can both see that mountaintop. So the robot bridges them, and your effective range goes from "a couple of miles on a good day" to the whole region its antenna can see — for W4TRC, essentially all of the Tri-Cities.

## The robot's mouth and ears

Now the clever part. The robot has to listen and talk at the same instant — that's what repeating means. But it can't do both on one frequency, for the same reason you can't hear someone whisper while you're shouting: its own voice would drown out everything else.

So the robot keeps its mouth and its ears on two different channels:

- **The mouth** is the repeater's output — the frequency it talks on, and the one everybody listens to. This is the number published for a repeater. W4TRC's mouth is 146.970 MHz.
- **The ears** are the input — the frequency it listens on, and the one your radio talks into. The ears sit a fixed distance away from the mouth, called the **offset**. On the 2-meter band that's 0.6 MHz; W4TRC's ears are 0.6 below, at 146.370 MHz.

```
  your voice  ─────────────►  146.370 MHz  (the robot's ears)
                                  │
                          [ Bays Mountain ]
                                  │
  your radio  ◄─────────────  146.970 MHz  (the robot's mouth)
```

Your handheld handles the switch by itself. Program it with the mouth frequency and the offset, and it listens on 146.970 — then the instant you press the talk button, it silently jumps down to 146.370 to speak into the robot's ears, and snaps back the moment you let go. You never notice. Two frequencies, one seamless conversation.

For the curious: keeping the robot's own shout from deafening its own ears is genuinely hard, because mouth and ears usually share a single antenna. The fix is a **duplexer** — a rack of scuba-tank-sized tuned metal cans that let one frequency through while blocking the other. It's the least glamorous and most critical hardware on the mountain.

## The secret knock

A receiver on a mountaintop hears everything — static crashes, distant repeaters on the same frequency, electrical noise from every direction. If the robot repeated all of it, it would babble around the clock.

So the robot only wakes up for people who know the secret knock. The knock is a **CTCSS tone** (old-timers say "PL tone"): a continuous low hum, pitched below where voices sit, that your radio hides underneath your speech. W4TRC listens for a 123.0 Hz hum. Hear the knock, repeat the signal. No knock, and the robot pretends you don't exist.

It isn't a security measure — the tone is published right next to the frequency; anyone can look it up. It's noise discipline. But it is the classic newcomer trap: program the frequency and offset correctly, forget the tone, and everything looks fine on your end while the mountain ignores you completely.

## One press of the button

Put it all together and here's what happens in the half-second after you key up:

1. Your radio jumps to the ears frequency and transmits your voice with the secret knock humming underneath.
2. The robot hears you, checks the knock, and keys its transmitter.
3. Your words blast out of the mouth frequency from the mountaintop at the same instant you speak — anyone within maybe forty miles hears you at full strength.
4. You let go. The robot hangs on for a second — the **squelch tail** — and marks the gap with a **courtesy beep**. That beep isn't decoration: it says "the other person is done," and the pause it enforces gives a third voice a chance to jump in. Then the transmitter drops and the robot goes back to listening.

That tail is also your built-in test meter. Key up, say your callsign, let go: if the tail and beep come back, you're hitting the machine. Silence means your frequency, offset, or tone is wrong — almost always the tone.

## Manners on the mountain

A repeater is shared infrastructure — one conversation at a time, built and maintained by a local club — and the culture around it reflects that:

- **Say who you are.** The FCC requires your callsign every ten minutes and when you sign off. Keying up silently just to hear the beep — "kerchunking" — is against the rules and the fastest way to be known unfavorably on a machine before anyone has met you.
- **Leave pauses.** The courtesy-beep gap exists so someone with emergency traffic, or just a third voice, can break in.
- **Listen first.** A minute of listening tells you whether a conversation or a scheduled net is already underway.
- **Nets are the front door.** Most clubs hold a weekly on-air meetup — W4TRC's is Sunday evenings at 8:30 — and they genuinely want newcomers to check in. It's the easiest first transmission you'll ever make: someone literally asks whether anyone new is listening.

## More than a relay

Modern repeaters rarely stop at relaying. Many are linked over the internet — EchoLink, AllStar, digital modes — so a handheld in Kingsport can, through the mountain, chat with a station on another continent. And because clubs treat them as emergency assets, good repeaters run on battery banks and solar panels. When a storm takes down the power grid — and the cell towers with it — the robot on the mountain keeps right on repeating. That resilience is a big part of why ham radio still matters when everything else fails.

## Try it yourself

Everything here is public and reproducible. RepeaterBook lists nearly every repeater in North America with its frequency, offset, and tone. Free software called CHIRP will program your whole local list into an inexpensive handheld in an afternoon. Listening requires no license at all — tune to a repeater's mouth frequency and you'll hear your local radio community going about its day. Talking takes a Technician-class license: a 35-question exam that a weekend of study will comfortably beat.

And the first time you press the button, say your callsign, and hear the mountain beep back — a robot two thousand feet over your head confirming it heard your little radio and shouted your words across three counties — you'll grin about this hundred-year-old technology like it was invented yesterday.
