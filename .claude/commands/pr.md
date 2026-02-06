# Create or Update Pull Request

`/pr` — auto-generated | `/pr "Custom title"` — custom title

## Steps

1. Analyze ALL commits: `git log main..HEAD --oneline && git diff main...HEAD`
2. Read `.claude/pr-template.md` for body structure, fill in each section
3. Check if `gh` CLI is available: `which gh 2>/dev/null`

### If `gh` is available:

4. Check for existing PR: `gh pr view --json number,title,body,url 2>/dev/null`
5. If PR exists: `gh pr edit`. If not: push branch + `gh pr create`
6. Return the PR URL

### If `gh` is NOT available:

4. Output the PR title and description as a markdown code block the user can copy

**Title format:** conventional commits — `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
