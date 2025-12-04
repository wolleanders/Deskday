# Deskday - Build & Distribution Instructions

## Quick Start: Build for Distribution

### Prerequisites
- Node.js & npm installed
- All dependencies installed (`npm install`)

### Build Options

#### **Option 1: Portable Executable (Recommended for Selling)**
```bash
npm run build:portable
```
- Creates: `dist/Deskday-0.1.1-portable.exe`
- **Zero installation** - Just download & run
- **Smallest download** (~200MB)
- **Fastest startup**
- **Best for website sales**

#### **Option 2: Installer (Professional)**
```bash
npm run dist
```
- Creates: `dist/Deskday Setup 0.1.1.exe` 
- Installs to Program Files
- Creates Start Menu shortcuts
- Creates Desktop shortcut
- Better for non-technical users

#### **Option 3: Both**
```bash
npm run build
```
- Creates both portable and installer

---

## Distribution Steps

### Step 1: Update Version (optional)
Edit `package.json`:
```json
"version": "0.1.2"
```

### Step 2: Build the App
```bash
npm run build:portable
```

### Step 3: Find Your Executable
- Location: `dist/Deskday-0.1.1-portable.exe`
- Size: ~200MB (includes Electron + all dependencies)

### Step 4: Test Before Distribution
1. Copy the `.exe` to a clean folder
2. Run it from there (no installation needed)
3. Test all features:
   - Login/Logout
   - Cloud sync
   - Schedule editing
   - Settings

### Step 5: Upload to Website
- Host the `.exe` file on your website
- Provide download link to customers

---

## Optimization Tips

### Reduce Startup Time
1. **Remove Unused Dependencies** (currently good)
2. **Lazy Load Modules** (already done)
3. **Optimize Main Process** (already optimized)

### Reduce File Size
- Current: ~200MB (mostly Electron framework)
- Can't reduce much without changing framework
- This is normal for Electron apps

### Auto-Updates (Future Enhancement)
To add auto-updates later, use `electron-updater`:
```bash
npm install electron-updater
```

---

## Sharing with Friend

### For Testing:
1. Build: `npm run build:portable`
2. Send: `dist/Deskday-0.1.1-portable.exe` (~200MB)
3. Friend just: Download → Run → Done!

### What to Tell Your Friend:
- No installation needed
- Just download and double-click
- First startup may take 10-15 seconds (Electron initialization)
- All data saved locally in `%APPDATA%/deskday`
- Can reset everything with `Ctrl+Shift+R`

---

## Troubleshooting

### Build Fails
```bash
# Clear old builds
rmdir dist /s /q
# Reinstall dependencies
npm install
# Try again
npm run build:portable
```

### Not Finding electron-builder
```bash
npm install --save-dev electron-builder
npm run build:portable
```

### Test Locally Before Sharing
```bash
# Make sure dev version works
npm start

# Build portable
npm run build:portable

# Navigate to dist folder
cd dist

# Run the portable exe
Deskday-0.1.1-portable.exe
```

---

## File Structure After Build
```
dist/
├── Deskday-0.1.1-portable.exe    ← Use this for selling
└── Deskday Setup 0.1.1.exe       ← Alternative installer
```

---

## Next Steps

1. **For Friend Testing:** Use `npm run build:portable`
2. **For Website Sales:** Upload the `.exe` to your hosting
3. **For Future Updates:** Bump version in `package.json` and rebuild

Good luck! 🚀
