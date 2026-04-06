---
description: Start Dev Server Automatically
---
This workflow enforces the rule that the dev server must always be running on port 3002.

After making any changes, improvements, or bugfixes to the React application, always execute this step to ensure the changes are active and accessible:

// turbo
1. Start the React server on port 3002 if it's not already running:
```bash
npm run dev -- --port 3002 --host
```

2. Review the changes on `http://localhost:3002` manually or by asking the user to confirm.
