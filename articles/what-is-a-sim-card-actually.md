# What Is a SIM Card, Actually?

![A SIM card opened up to reveal it is a tiny sealed computer, its contacts wired to a secret key it will never surrender](pix/sim-card-actually-og.png)

You have thumbed a dozen of them out of little trays with the tip of a paperclip. A fingernail of plastic with a gold rectangle printed on it, small enough to lose in the carpet, and somehow the one thing standing between your phone and being an expensive Wi-Fi-only camera. Move it to a new phone and your number, your carrier, and your identity move with it. Leave it out and the phone forgets who it is.

So what *is* the thing? A few honest guesses, all of which I've made:

- It's a little memory chip that stores my phone number.
- It's a security token — some crypto baked onto a bit of hardware.
- It's how the network authenticates me.

Every one of those is a shadow of the truth, and the truth is much better. The short version: **a SIM card is a complete, sealed-shut computer** — with its own processor, its own operating system, and a filesystem — whose entire job is to guard one secret so well that it will happily prove it knows the secret without ever letting the secret out. Authentication is what it's *for*. Being a tiny tamper-resistant computer is what it *is*.

Let's open it up.

## It's not a chip. It's a computer.

Peel back the gold contact plate and you are not looking at a memory stick. You are looking at a **smart card** — the same family of chip that lives in a chip-and-PIN credit card or a building access badge. The industry name for the hardware is a **UICC** (Universal Integrated Circuit Card); "SIM" is really the name of a program that runs *on* it.

On that sliver of silicon there is:

- a **CPU** — historically a humble 8- or 16-bit micro, now typically a 32-bit secure ARM core with hardware crypto accelerators;
- **ROM**, holding the card's operating system, burned in at the factory;
- **EEPROM or flash** — the writable, non-volatile memory that survives power-off, holding your data. Tens of kilobytes on an old card, up to a couple of megabytes on a modern one;
- a scrap of **RAM** for working memory;
- and a serial I/O line to talk to the phone.

That's a computer. A slow one with a thimble of storage, but a real one, running a real OS — very often a **Java Card** virtual machine, which means the card can host small installable applets. This is how carriers push those "SIM menu" services onto your phone: little programs living on the card itself, driving the handset through a mechanism called the **SIM Application Toolkit**.

The phone doesn't reach in and read the memory directly. It *asks*. The two of them speak a request-and-answer protocol over those gold pads, defined by an international standard called **ISO/IEC 7816**, in packets called **APDUs**. The phone sends a command — "select this file," "read those bytes" — and the card answers with data and a two-byte status code. `90 00` means "OK." It is, almost exactly, a tiny client and server talking over a two-wire network, where the wire is a strip of gold and the server is the size of your pinky nail.

## What bytes are actually on it?

Here is the part that surprised me most: the data on a SIM is organized as a **hierarchical filesystem**. Directories and files, just like your laptop — only in miniature, and standardized down to the byte by the GSM and 3GPP specifications so that any phone on Earth can read any carrier's card.

There are three kinds of node:

- **MF — the Master File.** The root directory, `3F00`. Every card has exactly one.
- **DF — a Dedicated File.** A directory. `7F20` (`DF_GSM`) holds network files; `7F10` (`DF_TELECOM`) holds your phonebook and messages.
- **EF — an Elementary File.** A leaf that holds actual bytes.

Files are named by two-byte IDs in hexadecimal, and the tree is walked exactly the way you'd `cd` through folders: select `3F00`, then `7F20`, then the file you want. Let's meet the famous residents.

**`2FE2` — the ICCID.** The card's serial number — the long digit string printed on the plastic itself. Twenty-ish digits identifying the card as a physical object, and it's readable by anyone with no PIN, which is why it's the first thing a forensics tool grabs. One nice quirk: the digits are stored **BCD-encoded with swapped nibbles** — a printed `8944…` is physically stored as the bytes `98 44 …`, two digits per byte, low half first. The whole card is full of this packed, nibble-swapped decimal.

**`6F07` — the IMSI.** This is the identity that matters — not your phone number, but the *subscriber* identity that says "this account, on this carrier." Up to 15 digits: a **country code**, a **network code**, and then your unique subscriber number. When you roam onto a tower in another country, this is the string that lets it figure out who to bill and which home network to phone for permission.

**`6F3A` — the phonebook, `6F3C` — your text messages.** Yes, the classic SIM phonebook is just an Elementary File full of fixed-length records, one contact per record: a name field, a length byte, and ten bytes of BCD-packed phone number. Text messages stored on the card sit in another file, 176 bytes per slot, each holding a raw SMS exactly as it arrived over the air. (A "deleted" contact is often just a record flagged free — the old bytes linger until something overwrites them. Forensics people love this.)

**Network scratchpad files.** The card also keeps notes about the world: a **TMSI**, a temporary throwaway identity the network assigns so your real IMSI isn't broadcast over the air every time; a record of the last location area it attached to; and a **forbidden-networks list** of carriers that have rejected it — which is exactly why a SIM can get stubbornly "stuck searching" after a bad roaming experience.

So, concretely: the bytes on a SIM are a few dozen small files — mostly packed-decimal identifiers, some network state, some of your personal phonebook and messages — sitting in a standardized directory tree, each file individually walled off by its own permissions.

## The one file you're not allowed to read

Every file has an access rule attached to each operation. Some are **Always** readable (the ICCID). Most of your subscriber data is readable only after the **PIN** is presented. A few can only be touched with the operator's administrative key.

And one is set to **Never**. Not "never without a password" — *never*, full stop, across the card's edge, by anyone, forever.

That file holds **Ki**: a 128-bit secret key, unique to your card, written once at the factory and then sealed. There is no command in the entire protocol that returns it. The phone can't read it. The carrier's own tools can't read it back off a finished card. You cannot read it. This is not a bug or an oversight — it is the entire point of the device.

Because if Ki never comes out, how does anything use it? That's the beautiful trick, and it's the answer to "how does authentication actually work."

## The handshake: proving a secret without revealing it

Your carrier's network knows your Ki too — it's stored, heavily guarded, in a database back at the carrier. So both ends share a secret that lives on the SIM and in the network, and *nowhere in between*. Authentication is a **challenge and response** built on exactly that.

In the original GSM (2G) design it went like this:

```
  network  ──►  RAND (128-bit random number)  ──►  SIM
                                                     │
                                    SIM runs a function of (Ki, RAND)
                                    entirely inside itself
                                                     │
  network  ◄──  SRES (32-bit answer) + Kc (call key) ◄──
```

The network makes up a fresh random number, RAND, and sends it as a dare. The SIM stirs RAND together with its buried Ki using an on-card algorithm and hands back a short answer, SRES, plus a key for encrypting the call. The network ran the *same* math with its copy of Ki; if the answers match, you're in. Ki itself never crossed the gap — only a one-time answer to a one-time question.

Elegant, and for its era, revolutionary. But it had two now-infamous flaws. The early algorithm carriers used, **COMP128-1**, turned out to be breakable: feed the card enough chosen challenges and you could reverse-engineer Ki and **clone the SIM**. And the handshake was **one-way** — the network verified your phone, but your phone never verified the network. Nothing stopped a fake tower from challenging you, and that gap is the ancestor of every "IMSI catcher" and Stingray you've read about.

3G, 4G, and 5G fixed both with a scheme called **AKA** (Authentication and Key Agreement), whose standard algorithm is **MILENAGE**, built on AES. The upgrade is that the challenge now comes with proof of who's asking:

```
  network  ──►  RAND  +  AUTN (an authentication token)  ──►  USIM
```

The USIM does more work now. It uses Ki (and a second operator secret) to check the **AUTN** token, and the token is constructed so that only the real network could have produced it. Bundled inside is a **sequence number** the card checks for freshness — so an attacker can't record a valid old exchange and replay it later. Only if both the network's proof and the freshness check pass does the card compute its response and its session keys.

That's **mutual authentication**: the card verifies the network as rigorously as the network verifies the card. The fake-tower trick that worked on 2G doesn't work here.

One subtlety worth getting right, because it's the crux of the whole design. The handshake produces session keys — a cipher key and an integrity key — and *those* do leave the card, handed up to the phone so it can actually encrypt the connection. What never leaves, on any generation, is **Ki**. The card is a sealed box that emits fresh, disposable keys on demand while the master secret they're derived from stays locked inside for the life of the card. Session keys are cheap and temporary; Ki is forever, and Ki never moves.

5G adds one more thing the earlier generations lacked: it stops broadcasting your identity in the clear. Older phones would sometimes send the raw IMSI over the air, which is exactly what IMSI-catchers listened for. A 5G SIM carries the carrier's **public key** and uses it to **encrypt your subscriber identity** before it's ever transmitted — concealing the one number that used to give you away. The tower forwards the sealed blob home; only the carrier can open it.

## So is a SIM just crypto? Just authentication?

Now we can answer the questions I started with.

Is it *just crypto on a bit of hardware*? No — it's a general-purpose secure computer that happens to be very good at crypto. The same tamper-resistant chip stores your phonebook, runs carrier applets, and in other form factors holds payment credentials and transit passes.

Is it *just authentication*? Authentication is the headline act, but the deeper description is: it's a **secure element** — a little vault that can hold secrets and perform operations with them without ever exposing them. Proving your subscriber identity is the most famous thing it does with that power. It is not the only thing it *could* do.

## The card with no card: eSIM

Which brings us to eSIM, the source of a lot of confusion. An eSIM is **the exact same computer**, soldered permanently onto the phone's board (or built straight into the main chip) instead of riding on a removable sliver of plastic. The hardware — called an **eUICC** — is identical in spirit: a sealed secure element with a Ki it will never surrender.

What changed is *how the identity gets on there*. A plastic SIM is personalized at a factory and mailed to you. An eSIM is blank, and your carrier's identity — called a **profile** — is downloaded onto it over the internet. That QR code you scan to activate a plan points the phone's **local profile assistant** at a carrier server (a mouthful named **SM-DP+**), which securely delivers a profile onto the chip. The eUICC can hold several profiles at once, which is why one phone can juggle a work line, a personal line, and a travel eSIM. Same sealed computer; the SIM is now software you can install.

## Try it yourself

None of this is behind glass. For under thirty dollars you can buy a **PC/SC smart-card reader** — the same kind of USB gadget that reads chip credit cards — and talk to a SIM you own directly.

The open-source **pySim** tools, from the Osmocom project, will walk the filesystem for you: select the files, dump the ICCID, read the IMSI, list the phonebook, page through stored messages. It is genuinely startling the first time you watch your own IMSI scroll up the terminal, decoded from nibble-swapped BCD, straight off the chip.

And then try to read Ki. You will send the command, and the card will refuse — not with your data, but with a status code that means *no*. You are holding the key in your hand, powering the very chip that computes with it billions of times, and you still cannot see it. That refusal is the most important byte the card will ever send you.

That, in the end, is the whole story of the SIM: a serial number printed on the outside for anyone to read, wrapped around a secret sealed on the inside for no one to read, connected by a computer whose only real talent is knowing the difference.

— Timothy
