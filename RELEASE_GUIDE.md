# Deskday Auto-Update Release Guide

## Setup (One-time)

### 1. Create GitHub Personal Access Token
1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `public_repo` scope (or `repo` for private repos)
3. Copy the token

### 2. Set Environment Variable
```powershell
# Set for current session
$env:GH_TOKEN="your_github_token_here"

# Or set permanently (Windows)
[System.Environment]::SetEnvironmentVariable('GH_TOKEN', 'your_github_token_here', 'User')
```

## Release Process

### Manual Release (Recommended)
1. **Set update token for private repo (required):**
   - Create a GitHub token with `repo` scope.
   - Set environment variable before build **and** ensure it is present at runtime on user machines (for private repos):
     ```powershell
     $env:GH_UPDATE_TOKEN="your_github_token_here"
     ```
   - If you make the repo public, you can skip the token.

2. **Build the installer:**
   ```powershell
   node scripts/generate-icon.js
   node node_modules\electron-builder\out\cli\cli.js --win nsis --publish never
   ```

3. **Upload to GitHub:**
   - Go to: https://github.com/wolleanders/Deskday/releases
   - Click "Draft a new release"
   - Tag: `v0.8.5` (match package.json version)
   - Title: `Deskday v0.8.5`
    - Upload these files from `dist/`:
       - `Deskday.Setup.0.8.5.exe`
       - `Deskday.Setup.0.8.5.exe.blockmap`
     - `latest.yml` (must be attached to the release; fetched by auto-updater)
   - Click "Publish release"

4. **Users get auto-updates:**
   - App checks for updates every 2 seconds after launch
   - Users see notification when update available
   - One-click install and restart

### Automated Release (With Token)
```powershell
# Set token first
$env:GH_TOKEN="your_token"

# Build and publish to GitHub
npm run release
```

## How Auto-Update Works

1. **On App Start:**
   - Checks GitHub releases API for new version
   - Compares with current version in package.json

2. **When Update Found:**
   - Downloads update in background
   - Shows notification to user
   - User clicks "Install" → app restarts with new version

3. **Configuration:**
   - Provider: GitHub Releases
   - Repo: `wolleanders/Deskday`
   - Feed: `latest.yml` from releases

## Testing

Test the updater locally:
1. Lower version in package.json (e.g., `0.8.4`)
2. Run `npm start`
3. Check console for update messages
4. App should detect v0.8.5 as available

## Current Version: 0.8.5

**Release Notes:**
- Weekly schedule: Per-day entries with dropdown selector (Monday-Sunday)
- Cloud save optimization: No blocking during editing
- Header redesign: Vertical day/date layout with improved visual hierarchy
- Options menu update: Added SSE and collapse buttons
- UI polish: Unified hover effects, tighter spacing

## Troubleshooting

**"Update not detected":**
- Verify GitHub release is published (not draft)
- Check tag matches version: `v0.8.5`
- Ensure `latest.yml` is uploaded to release

**"Failed to download update":**
- Check internet connection
- Verify release files are public
- Check GitHub token has correct permissions (for automated)

**"Auto-updater error":**
- Open DevTools (Ctrl+Shift+I) → Console
- Look for `[updater]` or `[main]` log messages
- Common: wrong GitHub repo name or missing token for private repos
