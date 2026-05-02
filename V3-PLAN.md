# Bob Foreman v3 — Build Plan

**Goal:** Add a Reviewer stage to Foreman, with measurable impact stats on the dashboard.

**How:** 6 parallel Bob workers. Each owns one file or one well-defined scope.
No worker reads or writes files outside its scope.

**Result:** A merged `master` with a working Reviewer-Bob, a dashboard counter
"Issues Auto-Fixed", and a per-run + lifetime stats history.

---

## Architecture (single source of truth)

The Reviewer is a Bob spawned in `foreman-reviewer` Custom Mode after all
build workers have merged. It reads the diff against `master~N`, looks for
issues (security, perf, error handling, code smells), and either:
  - fixes them with a `fix:` prefixed commit, OR
  - logs them as "skipped" in the report.

Every reviewer run writes a single JSON file:
`.foreman/tasks/reviewer.json`

```json
{
  "run_id": "2026-05-02T10:30:00Z",
  "summary": { "issues_found": 7, "auto_fixed": 5, "skipped": 2 },
  "interventions": [
    {
      "commit": "abc123",
      "file": "src/db.js",
      "issue": "no error handler on pool.connect",
      "fix": "added try/catch with finally{ pool.end() }"
    }
  ]
}
```

A second file maintains lifetime stats across all runs:
`.foreman/reviewer-history.json`

```json
{
  "lifetime": {
    "total_runs": 12,
    "total_issues_found": 47,
    "total_auto_fixed": 38,
    "total_skipped": 9
  },
  "runs": [
    { "run_id": "2026-05-02T10:30:00Z", "issues_found": 7, "auto_fixed": 5, "skipped": 2 }
  ]
}
```

---

## Build Strategy: Two Waves

Workers are spawned in two sequential waves, not all at once:

  - **Wave 1** (foundation, can run truly parallel — no shared file targets):
    - v3-coin-fix          → status-server.cjs (coin section only)
    - v3-reviewer-prompt   → .foreman-prompts/reviewer.txt (NEW)
    - v3-review-script     → scripts/foreman-review.ps1 (NEW)

  - **Wave 2** (integration — depends on Wave 1 being merged first):
    - v3-status-api        → status-server.cjs (adds /api/reviewer; reads Wave 1's coin fix)
    - v3-dashboard-card    → dashboard/index.html (consumes Wave 2's /api/reviewer)
    - v3-build-stage       → scripts/foreman-build.ps1 (calls Wave 1's review script)

Foreman waits for all three Wave 1 workers to merge before spawning Wave 2.
This eliminates merge conflicts on shared files and gives Wave 2 a stable
foundation to read from.

## File Ownership Matrix

Each row is exactly ONE Bob worker. No overlap.
If a worker needs to read a file owned by another worker, it reads what's
documented in this plan — not the actual file (which doesn't exist yet at
spawn time).

| Worker | Owns (writes) | Reads (existing) | Output Contract |
|---|---|---|---|
| **v3-coin-fix** | `status-server.cjs` (the coin-tracking section only) | existing `status-server.cjs` | API field `worker.coins` is correctly updated when worker logs include "coins:" lines |
| **v3-reviewer-prompt** | `.foreman-prompts/reviewer.txt` (NEW) | `V3-PLAN.md` (this file) | A prompt file ready to be loaded by `foreman-build.ps1` |
| **v3-review-script** | `scripts/foreman-review.ps1` (NEW) | `.foreman-prompts/reviewer.txt` contract from V3-PLAN | Standalone script that spawns one Bob in reviewer mode and writes `.foreman/tasks/reviewer.json` |
| **v3-status-api** | `status-server.cjs` (the API endpoints, additive only — no overlap with v3-coin-fix) | existing `status-server.cjs` | New `/api/reviewer` endpoint serving `{summary, lifetime, interventions}` |
| **v3-dashboard-card** | `dashboard/index.html` (one new card section, additive) | existing `dashboard/index.html` | "Issues Auto-Fixed" card with counter + expandable list, polls `/api/reviewer` every 2s |
| **v3-build-stage** | `scripts/foreman-build.ps1` (one new stage block at end of script, additive) | existing `scripts/foreman-build.ps1` | After all workers merged, calls `scripts/foreman-review.ps1` if `.foreman-prompts/reviewer.txt` exists |

---

## Critical Rules (every worker must obey)

1. **Edit existing files only by adding new sections — never reformat or restructure.**
   The next worker must still be able to find their landmarks.

2. **No worker touches `package.json`, `package-lock.json`, or `.gitignore`.**
   Those are stable. If you think you need to, the plan is wrong.

3. **All new files use UTF-8, LF line endings, 2-space indent.**

4. **Commit messages follow Conventional Commits:**
   - `feat: ...` for new features
   - `fix: ...` for bug fixes (especially the reviewer's own commits)
   - `chore: ...` for tooling

5. **No worker installs npm packages.**
   If your task seems to need one, refactor to use built-ins or talk to the human.

6. **API contracts:**
   - `/api/status` (existing): unchanged shape — only the coin field gets fixed
   - `/api/reviewer` (new): returns `{summary, lifetime, interventions[]}` per the JSON spec above

7. **Done = commit pushed to your worker branch + your contract verified.**
   Don't claim done if your output contract isn't met.

---

## Coin-Fix Bug Details (for v3-coin-fix worker)

Current state: Dashboard at http://localhost:8765/dashboard.html shows
"0.00 coins used" even though real Bob runs consume coins.

Root cause hypothesis: The status-server.cjs reads worker logs but doesn't
parse coin amounts from them, OR the logs don't contain coin info.

Investigation pattern:
1. Read existing `status-server.cjs` end to end
2. Find where `workers[].coins` is set
3. Check if it's reading from `.foreman/tasks/<task>.json`
4. If yes: ensure that JSON is being written with current coin count
5. If no: parse from log lines (Bob CLI emits `[coins: X.XX]` markers)

Test: After fix, run `node status-server.cjs` and curl `/api/status` —
the `worker.coins` field must reflect actual usage.

---

## Done-Definition

v3 is complete when:
1. All 6 worker branches merged to master cleanly
2. `node status-server.cjs` runs and `/api/reviewer` returns valid JSON
3. Dashboard shows the new "Issues Auto-Fixed" card (with zero values until first reviewer run)
4. `foreman-review.ps1 --target master~6..HEAD --dry-run` runs to completion (no commits, just verifies the pipeline)
5. The dashboard counter reflects the dry-run summary

The actual demo (with a planted bug for the reviewer to catch) is built
separately, after v3 is tagged. v3 itself ships clean — no demo artifacts
in the Foreman codebase.
