---
description: Stage all changes, commit with an auto-generated message, and push to origin/main
---

// turbo-all

1. Stage, auto-commit, and push in one shot (commit message is generated from changed files)
```
git add -A; $msg = "update: " + ((git diff --cached --name-only) -join ", "); if ($msg.length -gt 72) { $msg = $msg.Substring(0, 72) + "..." }; git commit -m $msg; git push
```
