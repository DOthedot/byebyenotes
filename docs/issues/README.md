# Issue log

This directory is the durable record of code-review findings and follow-up issues.
It is intended to give a later agent enough context to validate, fix, or close an
issue without rediscovering the original review.

## Naming

Create one report per review or discovery using this exact filename pattern:

```
issue_<unix_timestamp_seconds>.md
```

For example: `issue_1786546861.md`.

Obtain the timestamp when creating the file with `date +%s`. Do not rename an
existing report: its timestamp makes the report stable and chronological.

## Writing a report

Each report should include:

1. Review date and scope.
2. Findings ordered by severity (`High`, `Medium`, `Low`).
3. A concise impact statement, evidence with file-and-line links, and a proposed
   remediation for each finding.
4. Verification or test gaps.
5. A status field for every finding: `open`, `in progress`, `fixed`, `accepted`,
   or `not reproducible`.

Do not silently delete or rewrite findings after a fix. Instead, update the
finding's status and add a short resolution note with the validating test or
manual check. This preserves the audit trail and prevents duplicate work.

## Working an issue

Before making a change, read the newest relevant reports and verify that the
finding still applies to the current code. Keep fixes scoped to the issue unless
the user explicitly broadens the work. Add or update tests for the failure mode,
run the required verification, then update the report status.
