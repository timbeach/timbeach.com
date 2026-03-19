# Skill Design: publish-article

**Date:** 2026-03-18
**Scope:** Global Claude Code skill (`~/.claude/skills/publish-article.md`)
**Target project:** `~/code/PROJECTS/VULTR_0/sites/timbeach.com`

## Purpose

A Claude Code skill that enables publishing markdown articles to timbeach.com from any working directory on the machine. Accepts either a file path to an existing markdown file or inline conversation content. Handles the full workflow: content acquisition, image management, metadata generation, local preview, deployment, and git commit+push.

## Target Project Structure

```
timbeach.com/
├── articles/
│   ├── articles.json          # Central metadata registry (keys = filenames)
│   └── *.md                   # Article content files
├── pix/                       # Article images
├── index.html                 # Vanilla SPA (all HTML/CSS/JS)
├── deploy.sh                  # rsync to Vultr VPS
└── CLAUDE.md
```

### articles.json Entry Format

```json
{
  "kebab-case-filename.md": {
    "title": "Display Title",
    "date": "YYYY-MM-DD",
    "tags": ["tag1", "tag2"],
    "emoji": "unicode-emoji"
  }
}
```

No frontmatter in markdown files. All metadata lives in the JSON.

## Skill Procedure

### Step 1: Acquire Content

- **File path mode:** Read the file at the provided path. Validate it contains markdown with at least one heading.
- **Conversation mode:** Gather content from the user in conversation. Write it to a working markdown file.

### Step 2: Handle Images

1. Scan markdown for image references (`![alt](path)`)
2. For each referenced image:
   - Resolve the path relative to the source file's location
   - Copy the image file to `~/code/PROJECTS/VULTR_0/sites/timbeach.com/pix/`
   - Check for filename collisions in `pix/` — if a file with the same name already exists, warn the user and let them choose: overwrite, rename (e.g., `screenshot-2.png`), or skip
   - Rewrite the markdown image path to `pix/filename.ext` (relative to the site root, not `../pix/` — the SPA renders from root so `pix/` resolves correctly)
3. Ask the user: "Is there an additional image you'd like to include?"
   - If yes: copy it to `pix/`, insert a markdown image reference at the location the user specifies (or append)

**Note on image paths:** The site uses a custom markdown parser that injects image `src` attributes verbatim into `<img>` tags. Since the SPA runs from the site root, image paths should be `pix/filename.ext` (no leading `../`). Existing articles use `../pix/` which works only because browsers clamp `../` at the domain root. New articles should use `pix/` for correctness.

### Step 3: Propose Article Metadata

Infer all fields and present as a single proposed JSON entry for approval:

- **title**: Extracted from first `#` heading in the markdown
- **date**: Today's date (YYYY-MM-DD)
- **tags**: Suggested based on content analysis
- **emoji**: Suggested based on topic
- **filename**: Derived as kebab-case from the title, with `.md` extension

Present like:

```
Proposed articles.json entry:

  "my-article-title.md": {
    "title": "My Article Title",
    "date": "2026-03-18",
    "tags": ["linux", "tutorial"],
    "emoji": "🐧"
  }

Want to change anything, or does this look good?
```

User approves or tweaks in one shot.

### Step 4: Write Files

1. Copy (not move) the markdown content to `~/code/PROJECTS/VULTR_0/sites/timbeach.com/articles/{filename}.md`
   - Apply any image path rewrites from Step 2
   - If a file with the chosen filename already exists in `articles/`, warn the user and ask whether to overwrite or pick a different name
2. Update `articles/articles.json`:
   - Read the file and parse as JSON
   - Verify the new filename key does not already exist (warn and stop if it does)
   - Add the new entry to the JSON object
   - Serialize with 2-space indentation and a single trailing newline
   - Write back to the file

### Step 5: Local Preview

1. `cd` to `~/code/PROJECTS/VULTR_0/sites/timbeach.com` and start `python3 -m http.server 8000` as a background process
2. Tell the user: "Preview at http://localhost:8000#articles/{filename}.md"
3. Wait for approval
4. Kill the server process after approval or rejection

### Step 6: Deploy

On user approval:
1. Run `./deploy.sh` from the `~/code/PROJECTS/VULTR_0/sites/timbeach.com` directory (the script uses `$PWD/` as rsync source, so CWD must be correct)
2. Report rsync output to the user
3. Confirm deployment success

### Step 7: Git Commit + Push

1. `cd` to `~/code/PROJECTS/VULTR_0/sites/timbeach.com`
2. Stage only the specific changed files:
   - `articles/{filename}.md` (new article)
   - `articles/articles.json` (updated registry)
   - Any specific new image files in `pix/` (by name, not `pix/*`)
3. Commit with message: `Add article: {title}`
   - Do NOT include Co-Authored-By lines
4. Push to remote

## Error Handling

- If the source markdown file doesn't exist, tell the user and stop
- If `articles.json` can't be parsed, warn and stop (don't corrupt it)
- If the chosen filename already exists in `articles.json`, warn and let the user choose a different name
- If an image reference points to a nonexistent file, warn the user and skip that image
- If the local server port 8000 is in use, try 8001, 8002, etc.
- If `deploy.sh` fails, show the error and don't proceed to git commit
- If git push fails, show the error (don't force push)

## Markdown Parser Limitations

The site uses a custom lightweight markdown parser (not full CommonMark). Avoid:
- Nested formatting (bold inside italic)
- Raw HTML blocks
- Reference-style links/images (`[text][ref]`)

These will not render correctly. Standard headings, paragraphs, code blocks, inline code, bold, italic, links, images, tables, and lists all work fine.

## Constraints

- The timbeach.com repo path is hardcoded: `~/code/PROJECTS/VULTR_0/sites/timbeach.com`
- No build step required — the site is a vanilla SPA
- No frontmatter in markdown files — metadata is JSON-only
- The skill copies the source file; it never moves or deletes the original
- Emoji defaults to `📄` if the user removes it
- All commands that touch the timbeach.com repo must `cd` there first (the skill works from any CWD)

## Skill File Location

`~/.claude/skills/publish-article.md`

## Invocation

- `/publish-article ~/path/to/article.md` (file mode)
- `/publish-article` then provide content in conversation (conversation mode)
- Natural language: "publish this article to timbeach.com" (Claude recognizes the skill applies)
