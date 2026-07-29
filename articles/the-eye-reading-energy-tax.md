# The App I Built for the Eye-Reading Energy Tax

![Diagram of two input buses reaching one comprehension center: a faint dotted line from an eye node, a strong warm line from an ear node](pix/eye-reading-energy-tax-og.png)

I was diagnosed with dyslexia when I was eight years old, during my first year attending school outside the home. I hadn't learned to read yet. I spent most of the decades since carrying a quiet shame about that — and this is the story of the realization that finally put the shame down, and the tool I built once it was gone.

Here's what the shame looked like in practice. I always knew, deep down, that I had the intellect for academia. You can tell, talking with people — I could hold my own in understanding, in connecting ideas, in seeing the shape of a problem. But I could never get past a couple of semesters of college before burning out and moving on to something more interesting. The coursework wasn't beyond me. The reading was draining me. I'd watch classmates absorb a hundred assigned pages like the act itself was free, while the same pages cost me something real — focus, energy, hours. I was paying a tax they weren't paying, and I didn't have a name for it. So I named it the way ashamed people do: lazy. Undisciplined. Not cut out for it.

Meanwhile, the evidence for the defense was sitting right there in my headphones. I could listen to an entire Dostoevsky novel and enjoy every minute of it. Hundreds of pages of dense nineteenth-century Russian literature, no burnout, no tax. Same brain. Same ideas. Different door.

## The realization

A few weeks ago I finally learned what's actually going on in there, and it landed like a verdict being overturned.

Reading is not one skill — it's a relay between brain systems. When a typical reader sees a word, dedicated circuitry maps the visual symbols to speech sounds automatically. That mapping got wired in during childhood and now runs on background autopilot, effectively free. Dyslexia is a difference in exactly that machinery: the symbol-to-sound bridge never becomes automatic. It still works — but it runs manually, through a longer route, spending working memory and attention on every single word. The decoding bill arrives before comprehension ever gets to start.

Listening skips that bridge entirely. Spoken language flows through auditory pathways that a dyslexic brain runs at full speed, straight into the same comprehension machinery that eye-readers use. Same content, same understanding — delivered over a different bus, at a fraction of the energy cost.

That's the whole punch line of my life story, forty years late: eye-reading and ear-reading are two input buses to the same comprehension center, and mine are priced differently. Not broken. Priced differently.

And once you see it that way, the shame math flips completely. Getting the same ideas into your brain at a lower energy cost isn't cheating, and it isn't a lesser form of reading — it's resource management. It's what a smart, resourceful person does with an accurate spec sheet of their own hardware. The real waste was all the years I spent paying the expensive toll out of shame, because academia is built by and for eye-readers, and it taught me that the expensive road was the only legitimate one. It isn't. Comprehension is the destination; nobody at the destination asks which road you took.

## So I built for the ear bus

Once the shame was gone, the engineering problem was obvious: get any text, from anywhere, into my ears, with zero friction. I'd been improvising this for years — long before the AI boom I was converting PDFs to plain text and piping them through crude TTS on Linux, and my blog already reads itself aloud. But those were islands. I wanted a system.

It's called ear, and it's on the AUR right now.

The command line does what Unix tools should. Pipe anything into it. Point it at a Markdown file, a PDF, a URL. Highlight text anywhere on screen and hit a hotkey. Short snippets speak in under a second; longer reads get a warmer neural voice — the same British narrator my blog uses, so my whole machine speaks with one voice.

Under the hood, text gets cleaned, split into paragraphs, and synthesized one paragraph at a time into a playlist that starts playing immediately while the renderer runs ahead. Pause, skip by paragraph, change speed, stop and pick up days later exactly where you left off.

There's a listen-later shelf for long-form: point ear at a whole book and it renders in the background into a single audio file. My first test was a cryptography textbook — two thousand three hundred and eighty-one paragraphs, seventeen and a half hours of audio. I'm several hours in. A bash cookbook followed. My machine has quietly become an audiobook press.

And then there's the part I didn't know I needed: the desk. Typing ear opens a window that shows the text of whatever's playing and highlights each paragraph as it's spoken, scrolling along with the voice. Click any paragraph and playback jumps there. Feel what that does to the energy math: the ears carry the decoding load, and the eyes get promoted to a map — structure, skimming, jumping around — without paying the per-word toll. The reader renders in Atkinson Hyperlegible, the dyslexia-friendly typeface I already use everywhere. It's the first reading interface I've ever used that was designed for how I'm actually wired, and I know that for certain, because I designed it that way.

I built it with Claude Code in four days — spec first, then test-driven Rust, sixty-three tests by the end. It was almost called earbuss, after the Woven Summing Buss I used to hand-build in my audio-manufacturing days — a device that sums many input channels down to one output, which is exactly what this does with text. But the three-letter name was sitting free on the AUR, and some names you just pick up off the ground.

## Why my heart is full

Here's the part that gets me. Any Arch-based Linux user, anywhere, can now type yay -S ear, run ear-cli setup, and have their machine read anything to them — files, books, web pages, whatever their day throws at their eyes. Within a day of the AUR listing going live, the first community install came in: a friend's Framework laptop, hardware I've never touched, reading their files aloud.

I didn't build this as assistive technology, and I don't think of it that way. I built it because it's the correct engineering response to an accurate understanding of my own hardware. But I know how many people are out there paying the eye-reading energy tax without a name for it — grinding through pages at full toll, concluding they're lazy or not cut out for it, the way I did for decades. If even a few of them find this tool and feel the load lift, that's worth more to me than the tool itself.

So, to anyone whose story rhymes with mine: if reading print exhausts you and listening doesn't, you are not lazy and you are not less. You have a premium audio bus and an expensive visual one, and routing around the toll isn't a workaround — it's wisdom about your own machinery. Being resourceful about how ideas reach your brain is a form of intelligence. Nobody gets to grade you on which door the ideas came through.
