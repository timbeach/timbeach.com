# Use the Best Model. Your Time Is the Expensive Part.

![The model is cheap; your time is the expensive part.](pix/claude-is-cheap.png)

A senior engineer I respect asked me a fair question last week: *Is there a reason you're always using the latest, best Claude model?*

My answer was one sentence. Because it's the best, most capable model, and my time is a valuable resource.

That sounds glib, so let me show the arithmetic underneath it, and then — because every good default has an edge — the cases where reaching for the best model is the wrong move.

## The asymmetry nobody prices correctly

The instinct to reach for a cheaper model treats the model as the expensive thing. For interactive engineering work, that's backwards.

Compare the two costs honestly. A frontier model, used interactively for an hour of hard problem-solving, costs a few dollars — and on a flat-rate plan, the marginal cost of that hour is effectively zero. An hour of a senior engineer's time, fully loaded, costs the company one to two orders of magnitude more than that.

So the real question is never "should I spend money on the model?" It's "should I spend a small, known amount to de-risk a large, known amount?" The model is cheap. The hour is expensive. When the cheap thing makes the expensive thing go faster — even a little — you buy the cheap thing every single time. That's not extravagance. That's the most basic kind of leverage there is.

I have a personal subscription that costs a hundred dollars a month. For the work it lets me do, that is absurdly cheap. And I'll happily put my own account against company work, because the thing I'm actually conserving — the genuinely scarce resource — is my attention and my hours, which cost far more than the subscription either way.

## The best tools humans have ever had

Step back from the spreadsheet for a second. This is the most remarkable time in history to be an engineer. We have the best tools humans have ever had for doing intellectually hard work, and they get better every few months.

When that's true, deliberately handicapping yourself with a weaker tool — to save a rounding error — is a strange way to treat the privilege. You wouldn't ask a surgeon to use last decade's instruments to shave a few dollars off the tray. The value is in the outcome, not the consumable.

And the empirical part matters as much as the economic one: every time I've switched off the frontier model on its highest reasoning setting for serious work, I've gotten worse results. Not catastrophically worse — subtly worse. More back-and-forth, more missed edge cases, more of my time spent correcting instead of building. The cost of "saving money on the model" shows up immediately as a tax on the expensive resource.

## When the best model is the wrong call

A default isn't a dogma. "Always use the best model" is my default precisely *because* I know when to break it. Here's when I do.

**When the task saturates.** Refactoring one file to do something obvious. Renaming across a project. Mechanical transforms where every model gets it right. When the task is trivial enough that the cheapest model produces identical output, the quality difference is zero, so you optimize for speed and cost instead. There's no leverage to capture when there's no gap to close.

**When you're running inference at volume, not interacting.** This is the big one, and it's where the economics flip completely. Interactive coding is a handful of calls an hour. A production feature that calls a model on every request — millions of times a day — lives in a totally different cost regime. There, per-token price dominates, and the right move is to evaluate models against your actual task and pick the smallest one that clears the bar. The discipline isn't "always biggest" or "always cheapest." It's: measure, then right-size. Interactive work and batch inference are different problems with different answers.

**When latency is the product.** Some paths have a hard responsiveness budget — autocomplete, an interactive UI, anything a human is drumming their fingers waiting on. A faster, smaller model that answers in two hundred milliseconds can beat a smarter one that takes three seconds, because here speed *is* the quality.

**When you're deliberately building your own skill.** Sometimes I work a problem with no assistance on purpose, slowly, because the point is to deepen my own understanding, not to ship. That's a real reason to step down — but be honest that it costs the company more of your expensive hours, and choose it knowingly.

**When constraints decide for you.** Privacy rules, on-prem requirements, reproducibility needs — sometimes the best model simply isn't on the table, and the question is moot.

## The principle under all of it

Notice what every exception has in common: each one is a place where the gap between best and good-enough has genuinely closed, or where a different axis — speed, scale, cost-at-volume, privacy — has become the thing that matters. The exceptions don't contradict the rule. They *define* it.

So the rule is: for hard, interactive, judgment-heavy work — which is most of what I'm paid to do — use the best model on its highest setting, because your time is the expensive part and the model is the cheap part. Step down only when you can name the specific reason the gap has closed. If you can't name it, you're not saving money. You're taxing your most expensive resource to feel frugal about your cheapest one.

That's the whole argument. The model is cheap. Your judgment is not. Spend accordingly.
