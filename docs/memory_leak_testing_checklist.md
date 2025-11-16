# Comprehensive Testing Checklist

**Run ALL sections before committing any change.**

## When to Test
- ✅ After implementing any new feature
- ✅ After fixing any bug
- ✅ Before merging to main
- ✅ Before asking user to manually test
- ✅ Weekly during active development

---

# PART 1: MEMORY LEAK TESTING

## Testing Procedure

### 1. Baseline
1. Open app in Chrome
2. Open DevTools → Memory tab
3. Take heap snapshot → label "Baseline"
4. Note object counts

### 2. Perform Test Scenario
Choose one:
- Open/close Viewer 10 times
- Open/close Preview 10 times
- Add/remove Camera layer 10 times
- Toggle blur effects 10 times
- Go Live → End Session 10 times
- Pause/Resume stream 10 times

### 3. Force Garbage Collection
1. Click trash icon 🗑️ in Memory tab
2. Wait 2-3 seconds
3. Click trash icon again

### 4. Compare Snapshot
1. Take heap snapshot → label "After Test + GC"
2. Switch to "Comparison" view
3. Compare to Baseline

---

## Objects to Monitor

### Critical (Must Be 0 Leaks)
- **MediaStream**
  - Baseline: 0
  - After test: 0 (±1 acceptable during active use)
  - Location: Search "MediaStream" in snapshot

- **MediaStreamTrack**
  - Baseline: 0
  - After test: 0 (±1 acceptable)
  - Location: Search "MediaStreamTrack"

- **CanvasCaptureMediaStreamTrack**
  - Baseline: 0
  - After test: 0
  - Location: Search "CanvasCaptureMediaStreamTrack"

### Important (Should Not Accumulate)
- **RTCPeerConnection**
  - After Go Live test: 0 (all connections should close)
  - Location: Search "RTCPeerConnection"

- **HTMLVideoElement**
  - Should match number of active viewers
  - After closing all viewers: 0
  - Location: Search "HTMLVideoElement"

- **HTMLCanvasElement**
  - Baseline: ~3-5 (main canvas + background effect canvases)
  - Should not grow significantly
  - Location: Search "HTMLCanvasElement"

### Monitor (Check for Growth)
- **Detached HTMLElement**
  - React unmounted components not cleaned up
  - Location: Filter by "Detached"

- **Event Listeners**
  - Look for unreleased listeners
  - Location: Search for specific event types

---

## How to Read Retainers

When you find a leaked object:

1. Click on the object in heap snapshot
2. Look at bottom panel labeled "Retainers"
3. Read the retention path from bottom to top:

### Example Good Path (GC will collect):
```
GC Root → Closure → (no strong refs) → Object
```

### Example Bad Path (Leak!):
```
GC Root → Window → globalThis → myApp → streamRef → MediaStream
                                              ↑
                                          Not cleared!
```

### Common Leak Patterns:

**Pattern 1: Event Listener**
```
GC Root → Window → EventListener → Closure → MediaStream
```
**Fix:** Call `removeEventListener` in cleanup

**Pattern 2: Ref Not Cleared**
```
GC Root → Window → React Fiber → useRef → current → MediaStream
```
**Fix:** Set `ref.current = null` in useEffect cleanup

**Pattern 3: Global Storage**
```
GC Root → Window → __myGlobal__ → Map → MediaStream
```
**Fix:** Call `.delete()` or `.clear()` on Map

---

## Acceptance Criteria

### ✅ PASS
- All "Critical" objects at 0 (±1 during active use)
- "Important" objects match expected counts
- "Monitor" objects not growing over time
- Retainers show no application code holding objects

### ❌ FAIL
- Any Critical object count > 1 after GC
- Object count grows linearly with test cycles
- Retainers show app code (refs, closures, globals)
- "Detached" elements accumulating

---

## Quick Reference: Browser Console Commands

```javascript
// Count video elements
document.querySelectorAll('video').length

// Check if video has stream
document.querySelectorAll('video').forEach(v =>
  console.log(v.srcObject)
)

// Count canvases
document.querySelectorAll('canvas').length

// Force GC (if --js-flags="--expose-gc" enabled)
if (window.gc) window.gc();
```

---

## Test Results Template

```markdown
## Test: [Feature Name]
**Date:** YYYY-MM-DD
**Tester:** [Name]
**Scenario:** [e.g., Open/close viewer 10x]

### Results:
- MediaStream: Baseline 0 → After 0 ✅
- MediaStreamTrack: Baseline 0 → After 0 ✅
- CanvasCaptureMediaStreamTrack: Baseline 0 → After 1 ⚠️
- HTMLVideoElement: After 0 ✅

### Issues Found:
1. [Description of any leaks]
2. [Retainer path if available]

### Status: PASS / FAIL
```

---

## Common Fixes

### Leak: MediaStream in useRef
```typescript
// ❌ BAD
useEffect(() => {
  streamRef.current = createStream();
}, []);
// No cleanup!

// ✅ GOOD
useEffect(() => {
  streamRef.current = createStream();
  return () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        t.stop();
        streamRef.current?.removeTrack(t);
      });
      streamRef.current = null;
    }
  };
}, []);
```

### Leak: Event Listener
```typescript
// ❌ BAD
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);
// No cleanup!

// ✅ GOOD
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, [handleResize]);
```

### Leak: Interval/Timeout
```typescript
// ❌ BAD
const interval = setInterval(() => {}, 1000);
// No cleanup!

// ✅ GOOD
useEffect(() => {
  const interval = setInterval(() => {}, 1000);
  return () => clearInterval(interval);
}, []);
```

---

## Notes
- Run tests in **Incognito mode** to avoid extension interference
- Close other tabs to reduce noise in heap snapshot
- **Always force GC twice** before taking "after" snapshot
- If leak found, take multiple snapshots to confirm it's real

---

# PART 2: FUNCTIONAL TESTING

## Core Functionality Tests

### Canvas Rendering
- [ ] Canvas renders scene correctly on load
- [ ] Canvas updates when layers added/removed
- [ ] Canvas updates when layers moved/resized
- [ ] Canvas maintains aspect ratio
- [ ] **Resize window** - canvas stays visible (no black screen)
- [ ] Background color/image renders correctly
- [ ] All layer types render (text, camera, image, shape)

### Viewer Window
- [ ] Viewer opens via "Open Viewer" button
- [ ] **Stream starts immediately** without moving objects
- [ ] Stream shows live canvas updates
- [ ] Closing viewer doesn't crash app
- [ ] Reopening viewer works correctly
- [ ] Multiple open/close cycles work (test 10x)

### Preview Window
- [ ] Preview opens via "Show Preview" button
- [ ] Preview shows current scene
- [ ] Preview updates in real-time
- [ ] Closing preview doesn't crash app
- [ ] Preview doesn't create memory leaks (see Part 1)

### Camera Layers
- [ ] Can add camera layer
- [ ] Camera shows live video feed
- [ ] Can enable/disable camera
- [ ] Can remove camera layer
- [ ] Camera cleanup doesn't leak (see Part 1)

### Background Effects
- [ ] Blur effect works
- [ ] Background removal works (if implemented)
- [ ] Chroma key works (if implemented)
- [ ] Toggling effects on/off works
- [ ] Effects don't leak memory (see Part 1)

### Scene Management
- [ ] Can create new scene
- [ ] Can switch between scenes
- [ ] Can delete scene
- [ ] Scene state persists after refresh
- [ ] Layers save correctly

---

# PART 3: PERFORMANCE TESTING

## Frame Rate Tests

### Canvas Rendering
- [ ] Empty scene: 60 FPS (check DevTools Performance)
- [ ] 5 layers: ≥30 FPS
- [ ] 10 layers: ≥30 FPS
- [ ] With live camera: ≥30 FPS
- [ ] With blur effect: ≥24 FPS

### Stream Performance
- [ ] Viewer receives stream at ≥30 FPS
- [ ] No stuttering during playback
- [ ] No frame drops when editing scene
- [ ] Stream quality acceptable

## Resource Usage
- [ ] CPU usage <50% during idle
- [ ] CPU usage <80% during streaming
- [ ] Memory growth <10MB per minute
- [ ] No memory growth when idle

---

# PART 4: ERROR HANDLING

## Edge Cases

### Network Issues
- [ ] App handles offline state gracefully
- [ ] Reconnects when network restored
- [ ] Shows appropriate error messages

### Browser Compatibility
- [ ] Works in Chrome (primary)
- [ ] Works in Edge (Chromium)
- [ ] Shows compatibility warning in Firefox/Safari if needed

### User Errors
- [ ] Can't add camera without permission - shows error
- [ ] Can't start stream without canvas - shows error
- [ ] Handles window close during stream
- [ ] Handles page refresh during stream

### Resource Limits
- [ ] Handles very large scenes (50+ layers)
- [ ] Handles high-resolution canvases (4K)
- [ ] Degrades gracefully when resources limited

---

# PART 5: REGRESSION TESTING

**After ANY change, verify these don't break:**

### Critical Paths
- [ ] Preview button → 0 memory leaks ✅
- [ ] Viewer open/close → ≤1 stream leak
- [ ] Camera add/remove → 0 leaks
- [ ] Resize window → no black screen ✅
- [ ] Stream auto-starts ✅

### Known Fixed Bugs
- [ ] Preview creates 0 streams (was 4)
- [ ] Resize shows no black screen (was black)
- [ ] Stream starts immediately (was delayed)
- [ ] Viewer cleanup doesn't stop presenter's tracks

---

# PART 6: CONSOLE ERROR CHECK

**Before committing, check browser console:**

- [ ] No errors in console during normal use
- [ ] No warnings (or document known warnings)
- [ ] No failed network requests
- [ ] No React errors/warnings

**Common acceptable warnings:**
- Vite dynamic import warnings (known)
- Firebase emulator connection (when emulator off)

---

# PART 7: BUILD & TEST SUITE

## Automated Tests
```bash
# Run before every commit
npm test

# Expected: All tests pass
# Current: 35/35 tests passing
```

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No new test failures
- [ ] Code coverage doesn't decrease

## Build Check
```bash
# Must succeed before commit
npm run build
```

- [ ] Build succeeds with no errors
- [ ] No TypeScript errors
- [ ] Bundle size reasonable (<1MB)

---

# PART 8: AUTOMATED PRE-COMMIT CHECKLIST

**Copy this for every commit:**

```markdown
## Pre-Commit Checklist

### Memory Leaks
- [ ] Ran heap snapshot test (see Part 1)
- [ ] MediaStream: 0 leaks
- [ ] MediaStreamTrack: 0 leaks
- [ ] RTCPeerConnection: 0 leaks
- [ ] No detached DOM elements

### Functional
- [ ] Feature works as expected
- [ ] No console errors
- [ ] Resize works (no black screen)
- [ ] Stream auto-starts
- [ ] Preview/Viewer open/close works

### Performance
- [ ] FPS ≥30 during streaming
- [ ] CPU usage acceptable
- [ ] No memory growth over time

### Tests
- [ ] npm test passes (35/35)
- [ ] npm run build succeeds
- [ ] No new TypeScript errors

### Regression
- [ ] Existing features still work
- [ ] Fixed bugs stay fixed
- [ ] No new bugs introduced

**Status: READY / NEEDS WORK**
```

---

# Quick Reference Commands

```bash
# Development
npm run dev

# Run tests
npm test

# Build
npm run build

# Check TypeScript
npx tsc --noEmit

# Force GC in console (if enabled)
if (window.gc) window.gc();

# Check video elements
document.querySelectorAll('video').length

# Check canvas count
document.querySelectorAll('canvas').length
```
