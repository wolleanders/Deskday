# Setting Up Google OAuth Client Secret

## Problem
You're getting: `"error_description": "client_secret is missing."`

This means Google requires your **client secret** for the OAuth token exchange, even though you're using a Desktop app with PKCE.

## Solution

### Step 1: Get Your Client Secret
1. Open: https://console.cloud.google.com/apis/credentials
2. Look for your OAuth 2.0 credential (type: "Desktop application")
3. Click on it to open the details
4. Copy the **"Client secret"** value (long string starting with GOCSPX- or similar)

### Step 2: Create `.env` File
In your project root (same folder as main.js), create a file named `.env`:

```
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

Replace `your_client_secret_here` with the actual secret from Step 1.

### Step 3: Install dotenv Package
Run in terminal:
```powershell
npm install dotenv
```

### Step 4: Restart Your App
Close the app and restart it. The OAuth flow should now work! ✓

---

## File Structure After Setup

```
Deskday/
├── main.js
├── preload.js
├── package.json
├── .env              ← CREATE THIS FILE
├── .env.example      ← Already exists (for reference)
└── ... other files
```

---

## Security Notes

⚠️ **IMPORTANT:**
- Never commit `.env` to version control (add to `.gitignore`)
- The `.env.example` file shows the format but without the actual secret
- Keep your client secret private!

Your `.gitignore` should include:
```
.env
node_modules/
dist/
```

---

## What Changed

Your `main.js` now:
1. ✅ Loads environment variables with `require('dotenv').config()`
2. ✅ Requires `GOOGLE_CLIENT_SECRET` to be set
3. ✅ Always includes `client_secret` in OAuth token exchange
4. ✅ Shows helpful error if secret is missing

---

## Testing

After setup:
1. Start app
2. Click "Log in"
3. Complete OAuth in browser
4. Should return to app logged in ✓

If still failing:
- Check console for error messages
- Verify `.env` file exists and has correct secret
- Make sure `npm install dotenv` completed

