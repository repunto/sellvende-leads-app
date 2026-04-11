# Project Memory & Rules

## Dev Server Auto-Start
At the START of EVERY session, you MUST run this command:
```
powershell -ExecutionPolicy Bypass -File start-dev.ps1
```
This verifies if localhost:3002 is running and starts it if needed.

After any deployment, code change, or task completion, VERIFY the dev server is still responding:
```
curl -sI http://localhost:3002
```
If it returns HTTP 200, it's running. If not, restart with the script above.

## Never kill the dev server unless explicitly asked to.
## Never assume the server is running - always verify first.
