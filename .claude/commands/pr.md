# Create or Update Pull Request

Create a new PR or update an existing one with title and description.

## Usage

`/pr` - Create/update PR with auto-generated content
`/pr "Custom title"` - Create/update PR with custom title

## Instructions

### Step 1: Check if PR already exists

```bash
gh pr view --json number,title,body,url 2>/dev/null
```

### Step 2: Analyze changes

```bash
git log main..HEAD --oneline
git diff main...HEAD --stat
git diff main...HEAD
```

Review ALL commits to understand full scope of changes.

### Step 3: Read the PR template

Read `.claude/pr-template.md` for the PR body structure. Fill in each section based on the changes analyzed in Step 2.

### Step 4: If PR EXISTS - Update it

Use `gh pr edit` with the filled-in template as the body.

### Step 5: If NO PR - Create new one

Push the branch and use `gh pr create` with the filled-in template as the body.

### Step 6: Return the PR URL

Always provide the PR URL at the end.

## PR Title Format

Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
