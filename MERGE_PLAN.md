# Merge Plan: Phone Camera + Delayed Start Features

## Branches to Merge
- **Source:** `claude/add-delayed-start-01QRWYf93uhurH29cwL6LprL` (chat, bots, AI features)
- **Target:** `claude/phone-camera-stream-01Q6HFNE4Gm5MC4WDmaKsA34` (phone camera)
- **Common Ancestor:** `5ea63c0` (Phase 1-3 Code Cleanup)

## Files Modified in Both Branches

### 1. package.json / package-lock.json
- **Other branch:** Added AI/chat dependencies
- **This branch:** Added `qrcode` for phone camera
- **Resolution:** Both dependencies needed, simple merge

### 2. src/components/LayersPanel.tsx
- **Other branch:** Likely added chat-related UI
- **This branch:** Added phone camera button
- **Resolution:** Both changes needed, merge carefully

### 3. src/pages/PresenterPage.tsx
- **Other branch:** Added chat/bot UI and controls
- **This branch:** Added phone camera stream handling
- **Resolution:** Both features needed, merge carefully

## Recommended Merge Strategy

### Option 1: Merge Other Branch into This Branch (Recommended)
```bash
# You're currently on: claude/phone-camera-stream-01Q6HFNE4Gm5MC4WDmaKsA34
git merge origin/claude/add-delayed-start-01QRWYf93uhurH29cwL6LprL
# Resolve conflicts if any
# Test combined features
# Push to current branch
```

**Pros:**
- Keeps phone camera work as the "main" branch
- Easier to track phone camera changes
- Can test incrementally

### Option 2: Create New Combined Branch
```bash
git checkout -b claude/combined-features
git merge origin/claude/add-delayed-start-01QRWYf93uhurH29cwL6LprL
git merge claude/phone-camera-stream-01Q6HFNE4Gm5MC4WDmaKsA34
# Resolve conflicts
# Test combined features
```

**Pros:**
- Clean separation, doesn't pollute either branch
- Can keep both original branches intact

## Potential Conflicts to Watch For

### LayersPanel.tsx
- Other branch may have added buttons/controls
- This branch added phone camera button
- **Action:** Make sure both features coexist

### PresenterPage.tsx
- Other branch added chat/bot state and UI
- This branch added phone camera state and callbacks
- **Action:** Merge state management, ensure no variable name collisions

### package.json
- Other branch added many AI dependencies
- This branch added qrcode
- **Action:** Combine all dependencies

## Testing After Merge

1. **Phone Camera Still Works**
   - QR code generates
   - Phone connects
   - Stream appears on canvas

2. **Chat/Bot Features Still Work**
   - Chat panel opens
   - Messages send/receive
   - Bots respond

3. **No Conflicts Between Features**
   - Phone camera + chat visible at same time
   - Both can be added as layers
   - No state collisions

## Merge Steps

1. **Prepare**
   ```bash
   git status  # Make sure working directory is clean
   git fetch origin  # Update remote refs
   ```

2. **Create backup branch (optional)**
   ```bash
   git branch backup-phone-camera HEAD
   ```

3. **Merge**
   ```bash
   git merge origin/claude/add-delayed-start-01QRWYf93uhurH29cwL6LprL
   ```

4. **Resolve conflicts** (if any)
   - Open conflicted files
   - Look for `<<<<<<<`, `=======`, `>>>>>>>`
   - Keep both sets of changes
   - Remove conflict markers
   - Test the code

5. **Test thoroughly**
   - Run `npm install` (new dependencies)
   - Run `npm run dev`
   - Test phone camera
   - Test chat/bot features

6. **Commit merge**
   ```bash
   git add .
   git commit  # Git will auto-generate merge commit message
   ```

7. **Push**
   ```bash
   git push origin claude/phone-camera-stream-01Q6HFNE4Gm5MC4WDmaKsA34
   ```
