# How to Add Articles to This Site

This site uses a custom, lightweight article system that makes it easy to add new content without any complex build processes or databases.

## How It Works

The system consists of two simple components:

1. **Markdown files** - Your actual article content
2. **JSON metadata** - Article information like title, date, and tags

## Adding a New Article

### Step 1: Create the Markdown File

Create a new markdown file in the `articles/` directory:

```bash
# Example: articles/my-new-article.md
echo "# My New Article" > articles/my-new-article.md
```

Write your article content using standard markdown syntax:

```markdown
# My New Article

This is my new article content.
```

## Features

- **Code blocks** work perfectly
- **Bold** and *italic* text
- [Links](https://example.com) to external sites

## Code Example

```bash
# This is a comment
echo "Hello, World!"
```

The system supports all standard markdown features!

### Step 2: Add Metadata to JSON

Add an entry to `articles/articles.json`:

```json
{
  "my-new-article.md": {
    "title": "My New Article",
    "date": "2025-07-29",
    "tags": ["tutorial", "example", "markdown"]
  }
}
```

### Step 3: That's It!

The article will automatically appear in the articles list. No build process, no database, no complex CMS - just files and JSON.

## System Features

### Automatic Loading
- Articles load from markdown files when available
- Falls back to built-in content if files aren't accessible
- No server-side processing required

### Markdown Support
- Full markdown syntax support
- Code blocks with language highlighting
- Links, images, and formatting
- Lists, tables, and more

### Simple Maintenance
- Version control friendly (just text files)
- Easy to backup and restore
- No database migrations or complex deployments

## File Structure

```
timbeach.com/
├── articles/
│   ├── articles.json          # Article metadata
│   ├── my-article.md          # Article content
│   └── another-article.md     # More articles...
└── index.html                 # The main site
```

## Benefits of This Approach

- **Simplicity** - Just markdown and JSON
- **Performance** - Static files load fast
- **Reliability** - No database dependencies
- **Portability** - Easy to move or backup
- **Version Control** - Text files work great with git

This system proves that you don't need complex tools to create a beautiful, functional website. Sometimes the simplest solution is the best solution. 