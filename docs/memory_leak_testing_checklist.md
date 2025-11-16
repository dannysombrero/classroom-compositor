# Memory Leak Testing Checklist

## When to Test
- After implementing any new feature
- After fixing any bug
- Before merging to main
- Weekly during active development

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
