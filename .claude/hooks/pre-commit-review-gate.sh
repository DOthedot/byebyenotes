#!/usr/bin/env bash
# PreToolUse hook (Bash matcher) — pre-commit review gate for byebyenotes.
#
# Blocks `git commit` unless a fresh code-reviewer report
# (.claude/reviews/latest.md) approves the current diff of the gated
# paths (app.js, style.css, index.html, api/**). See AGENTS.md and
# .claude/agents/code-reviewer.md.
#
# Escape hatch: include BBN_SKIP_REVIEW=1 anywhere in the commit command,
# e.g. `BBN_SKIP_REVIEW=1 git commit -m "hotfix"`.
#
# Deliberately avoids `set -e` — every path must reach an explicit exit 0
# (allow) or print a deny JSON then exit 0; an unexpected mid-script abort
# must never silently fall through to "allow".

input="$(cat)"
command="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"

# Only gate commands that actually run `git commit` (handles compound
# commands like `git add -A && git commit -m "..."`).
if ! printf '%s' "$command" | grep -Eq '(^|[;&|]|[[:space:]])git[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi

if printf '%s' "$command" | grep -q 'BBN_SKIP_REVIEW=1'; then
  echo '{"systemMessage":"code-reviewer gate bypassed via BBN_SKIP_REVIEW=1"}'
  exit 0
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$repo_root" ]; then
  exit 0
fi
cd "$repo_root" || exit 0

GATED_PATHS=(app.js style.css index.html api)
BYPASS_HINT="Emergency bypass: include BBN_SKIP_REVIEW=1 in the commit command."

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

# Nothing gate-worthy changed since HEAD (staged + unstaged combined —
# this repo's normal flow is `git add -A && git commit` in one call, so
# files may not be staged yet when this hook fires).
if git diff --quiet HEAD -- "${GATED_PATHS[@]}" 2>/dev/null; then
  exit 0
fi

current_hash="$(git diff HEAD -- "${GATED_PATHS[@]}" 2>/dev/null | shasum -a 256 | awk '{print $1}')"

report="$repo_root/.claude/reviews/latest.md"

if [ ! -f "$report" ]; then
  deny "Blocked: app.js/style.css/index.html/api changed but no code-reviewer report found at .claude/reviews/latest.md. Dispatch the code-reviewer subagent on this diff, address its findings, then commit again. $BYPASS_HINT"
fi

marker="$(grep -m1 '^<!-- bbn-review:' "$report")"
stored_hash="$(printf '%s' "$marker" | grep -oE 'sha256=[a-f0-9]{64}' | cut -d= -f2)"
verdict="$(printf '%s' "$marker" | grep -oE 'verdict=[A-Z_]+' | cut -d= -f2)"

if [ -z "$stored_hash" ] || [ -z "$verdict" ]; then
  deny "Blocked: .claude/reviews/latest.md has no valid bbn-review marker. Re-run the code-reviewer subagent so it regenerates the report, then commit again. $BYPASS_HINT"
fi

if [ "$stored_hash" != "$current_hash" ]; then
  deny "Blocked: the diff has changed since the last code-reviewer report (.claude/reviews/latest.md is stale). Re-run the code-reviewer subagent on the current diff, then commit again. $BYPASS_HINT"
fi

if [ "$verdict" = "CHANGES_REQUESTED" ]; then
  deny "Blocked: code-reviewer verdict for this diff is CHANGES_REQUESTED (see .claude/reviews/latest.md). Fix the findings, re-run the review, then commit again. $BYPASS_HINT"
fi

exit 0
