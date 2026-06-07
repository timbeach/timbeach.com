# One Command to Paste Markdown Into Medium

![Infographic for "One Command to Paste Markdown Into Medium": an article.md terminal flows through a central text/html "rich clipboard" into the Medium editor, with panels on why it became a real tool (images, embeds, fixes for Medium/Substack/Ghost), the clipboard as the seam, and the invisible-newlines blockquote gotcha. Footer: "Write in markdown. Copy as HTML. Paste anywhere."](pix/paste-markdown-into-medium.png)

I write everything in markdown. Plain text, version-controlled, the same format whether it's a README, a note to myself, or an article headed somewhere with a nicer font. Then I go to publish on Medium and the spell breaks: paste my markdown into their editor and it shows up as literal `## headings` and `**asterisks**`, the formatting sitting there inert. The obvious fix — let a script publish for me through Medium's API — turns out to be a door that's been quietly nailed shut.

## The API is gone

Medium had a real publishing API once: an integration token, a `POST` to create a post, the whole thing documented on GitHub. As of 2025 they stopped issuing new tokens and stopped allowing new integrations. The docs repo is archived with a note at the top: *the Medium API is no longer supported.* Old tokens still work; new ones can't be minted. So if you didn't already have one, programmatic publishing simply isn't on the table anymore.

That sounds like a dead end. It isn't — it just means the seam is somewhere less obvious.

## The seam is the clipboard

Medium's editor ignores pasted markdown *text*. But like most rich-text editors, it pays close attention to the `text/html` flavor of the clipboard. Paste plain text and you get plain text; paste HTML and it reconstructs headings, bold, links, lists. The browser carries two versions of whatever you copy, and the editor reaches for the formatted one.

Which means the entire problem collapses to: turn markdown into HTML, and put it on the clipboard *as HTML*. On X11 that's one pipe:

```sh
comrak article.md | xclip -selection clipboard -t text/html
```

`comrak` does markdown-to-HTML; `xclip -t text/html` sets the rich-text flavor specifically. Paste into Medium and the formatting survives. That one line is genuinely 80% of the job, and for a quick post it's all you need.

> The hard part of a problem is often a layer below where you're looking. I was hunting for an API; the answer was a clipboard MIME type.

## Why it wanted to be a real tool

The one-liner is honest about what it is. The remaining 20% is the stuff that only shows up once you paste a *real* article — and that's what earns a proper binary. So I wrote one: `mdpaste`, a single Rust binary that parses the markdown to a syntax tree, fixes the things each editor mangles, and hands over clean HTML. It carries quirk profiles for Medium, Substack, and Ghost, since they all honor the same clipboard trick.

A few of the fixes:

- **Images.** A pasted `<img>` only works if its `src` is a public URL — the editor can't see a path on my laptop. My article images already live on my own site, so `mdpaste` rewrites relative paths like `pix/shot.png` into `https://timbeach.com/pix/shot.png` and warns me about any local path it can't place.
- **Embeds.** A bare YouTube or gist URL sitting alone on a line gets auto-expanded into an embed card — but only if it's a *bare* URL, not a markdown link. So a paragraph that's nothing but a link to an embed host gets unwrapped back down to the naked URL.

## The gotcha: invisible newlines

The fix I didn't see coming was blockquotes. I pasted a finished article, and every quote came through padded with a blank line above and below the text — like the quote was holding the words at arm's length. The HTML looked fine:

```html
<blockquote>
<p>...the quoted text...</p>
</blockquote>
```

Those newlines after `<blockquote>` and before `</blockquote>` are meaningless when a browser renders the page — whitespace between block tags is collapsed and you'd never know it was there. But Medium's paste importer is not a browser. It reads each of those newlines as content and turns them into empty lines inside the quote. The cleanup is almost too small to mention: strip the newlines on the inside edges of the blockquote so the editor gets `<blockquote><p>...</p></blockquote>` in one piece. Identical rendering everywhere, tidy quote on paste.

I'd never have predicted that one. It only surfaced because I actually pasted and *looked* — which is the whole lesson. You can reason about an HTML-to-editor pipeline all day, but the editor is a black box on the far side of the clipboard, and the only way to know what it does with your markup is to send some across and watch.

## Why bother

Because the boring, repeated thing should stay boring. I write in markdown, run one command, and paste a clean, formatted draft into Medium — images resolved, embeds embedding, quotes sitting tight. It's a single binary, no daemon, no account, no API that can be turned off from under me. When the official door closes, the clipboard is still wide open.

This very article made the trip that way.

`mdpaste` is on GitHub: [github.com/timbeach/mdpaste](https://github.com/timbeach/mdpaste).
