# Pushing this repository

This repo had no remote configured at first commit. To push to GitHub:

```bash
# Option A: existing empty repo
git remote add origin git@github.com:YOUR_ORG/aetherforge_IDE.git
git push -u origin main

# Option B: create with GitHub CLI
gh repo create YOUR_ORG/aetherforge_IDE --private --source=. --remote=origin --push
```

Ensure `coverage/`, `test-results/`, and `node_modules/` are not committed (see root `.gitignore`).
