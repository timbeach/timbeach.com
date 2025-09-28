# Adding Articles to timbeach.com is parsimonious

This site uses a custom, lightweight article system that makes it easy to add new content without any complex build processes or databases.

## Use This System for Your Own Site

Want to build your own website with this article system? The complete source code is available on GitHub at [https://github.com/timbeach/timbeach.com](https://github.com/timbeach/timbeach.com). You can fork the repository and customize it for your own content while keeping the parsimonious design philosophy intact.

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

## Advanced Features

### Terminal Integration
The site features a terminal-style navigation system with commands:
- `ls` - List articles and directories
- `cd articles` - Navigate to articles directory
- `cat filename.md` - Display article content
- `tree` - Show directory structure with articles sorted by date
- `help` - Show all available commands

### Dynamic Loading System
The JavaScript implementation includes:
- **Graceful fallback** - If external files fail to load, built-in content is displayed
- **Cache busting** - Timestamp parameters prevent browser caching issues
- **Smooth transitions** - Content fades in/out during navigation
- **Direct linking** - URLs like `#articles/filename.md` work for sharing specific articles

### Markdown Parser
The custom markdown parser handles:
- Headers (H1, H2, H3)
- Code blocks with language highlighting
- Inline code formatting
- Bold and italic text
- Links with target="_blank"
- Paragraph wrapping
- Preserves formatting within code blocks

### Search Functionality
When viewing the articles directory:
- Real-time search by title or filename
- Case-insensitive matching
- Instant filtering of article list

## Technical Implementation Details

### Data Flow
1. **Page Load**: JavaScript fetches `articles/articles.json`
2. **Article Request**: When user clicks an article, JavaScript fetches the `.md` file
3. **Parsing**: Custom markdown parser converts content to HTML
4. **Display**: Content appears with terminal-style navigation

### Error Handling
- **Network failures**: Falls back to built-in article content
- **Missing files**: Shows "Article Not Found" message with error details
- **JSON parse errors**: Gracefully handles malformed metadata

### Performance Optimizations
- **Lazy loading**: Articles only load when requested
- **Minimal dependencies**: No external JavaScript libraries
- **Efficient caching**: Browser caches static files naturally
- **Small footprint**: Entire site is a single HTML file + articles

## File Naming Conventions

Use lowercase with hyphens for readability:
- ✅ `my-article-title.md`
- ✅ `linux-tutorial.md`
- ❌ `MyArticleTitle.md`
- ❌ `my_article_title.md`

## Deployment

The deployment is equally simple:
```bash
./deploy.sh
```
This rsync script pushes all changes to the production server, excluding `.git/`, `archive/`, and `.well-known/` directories.

This system proves that you don't need complex tools to create a beautiful, functional website. Sometimes the simplest solution is the best solution - and this custom article system exemplifies the philosophy of parsimony in web development. 