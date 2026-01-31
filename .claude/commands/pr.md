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

### Step 3: If PR EXISTS - Update it

```bash
gh pr edit --title "feat: new title" --body "$(cat <<'EOF'
## What?
Summary of changes

## Why?
Context and value delivered
EOF
)"
```

### Step 4: If NO PR - Create new one

```bash
git push -u origin HEAD
gh pr create --title "feat: description" --body "$(cat <<'EOF'
## What?
- Summary of changes

## Why?
- Context for the changes
EOF
)"
```

### Step 5: Return the PR URL

Always provide the PR URL at the end.

## PR Title Format

Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
