# Phone Camera Feature - QC Analysis & Test Plan

## Executive Summary
Comprehensive quality control analysis of the phone camera streaming feature, identifying potential memory leaks, race conditions, error scenarios, and edge cases.

---

## 🔴 CRITICAL ISSUES FOUND

### 1. MediaStream Leak in PhoneCameraPage
**File:** `src/pages/PhoneCameraPage.tsx`
**Line:** 178-225 (useEffect cleanup)

**Issue:** When camera is flipped, the old stream is stopped but the peer connection still references it. The new track replaces the sender, but the old stream's video element in sourceManager is not cleaned up.

**Code:**
```typescript
const flipCamera = async () => {
  const newFacing = facingMode === 'user' ? 'environment' : 'user';
  setFacingMode(newFacing);

  const mediaStream = await startCamera(newFacing);
  if (mediaStream && pcRef.current) {
    const videoTrack = mediaStream.getVideoTracks()[0];
    const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');

    if (sender && videoTrack) {
      await sender.replaceTrack(videoTrack);
      console.log('[PhoneCamera] Camera track replaced');
    }
  }
};
```

**Problem:** The old stream in `stream` state is stopped in `startCamera`, but there's no cleanup of the old video element reference.

**Risk Level:** MEDIUM - Causes memory leak with each camera flip
**Fix Required:** Yes

---

### 2. Peer Connection Not Closed on Phone Page Navigate Away
**File:** `src/pages/PhoneCameraPage.tsx`
**Line:** 221-225

**Issue:** If user navigates away or closes browser, cleanup happens in useEffect, but if browser kills the tab instantly, cleanup might not run.

**Code:**
```typescript
return () => {
  unsubscribersRef.current.forEach(unsub => unsub());
  if (pcRef.current) {
    pcRef.current.close();
  }
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
};
```

**Problem:** `pagehide` or `beforeunload` event not used for guaranteed cleanup.

**Risk Level:** MEDIUM - Leaves orphaned peer connections on host
**Fix Required:** Yes

---

### 3. Race Condition: Multiple Phone Cameras with Same ID
**File:** `src/utils/phoneCameraWebRTC.ts`
**Line:** 171-177

**Issue:** If same cameraId is used twice (e.g., browser back/forward), the check `phoneCameraConnections.has(cameraId)` will skip the new connection, but the old one might be dead.

**Code:**
```typescript
if (phoneCameraConnections.has(cameraId)) {
  console.log("⚠️ [HOST] Already have connection for camera:", cameraId);
  return;
}
```

**Problem:** Should check if existing connection is still alive, not just if it exists.

**Risk Level:** HIGH - Phone can't reconnect with same cameraId
**Fix Required:** Yes

---

### 4. Firestore Listener Leak in PresenterPage
**File:** `src/pages/PresenterPage.tsx`
**Line:** 178-225

**Issue:** Phone camera callbacks are set in useEffect, but if component unmounts and remounts, old callbacks might still fire.

**Code:**
```typescript
useEffect(() => {
  setPhoneCameraStreamCallback(async (cameraId: string, stream: MediaStream) => {
    // ... creates layer ...
  });

  setPhoneCameraDisconnectCallback((cameraId: string) => {
    console.log("📱 [PresenterPage] Phone camera disconnected:", cameraId);
  });

  return () => {
    stopPhoneCameraHost();
  };
}, [getCurrentScene, addLayer, removeLayer, updateLayer]);
```

**Problem:** `setPhoneCameraStreamCallback` doesn't unset the callback on unmount. If component remounts, callback references stale closures.

**Risk Level:** HIGH - Stale closures can cause crashes
**Fix Required:** Yes

---

### 5. Missing Track Ended Listener for Phone Camera Streams
**File:** `src/pages/PresenterPage.tsx`
**Line:** 206-210

**Issue:** When phone camera stream is registered, no `ended` event listener is added to clean up the layer when phone disconnects abruptly.

**Code:**
```typescript
const track = stream.getVideoTracks()[0];
if (track) {
  updateLayer(layerId, { streamId: track.id });
  console.log("✅ [PresenterPage] Phone camera layer created:", layerId);
}
```

**Problem:** Compare to `addCameraLayer` which has:
```typescript
track.addEventListener("ended", () => {
  stopSource(layerId);
  useAppStore.getState().removeLayer(layerId);
});
```

**Risk Level:** MEDIUM - Dead layers remain when phone disconnects
**Fix Required:** Yes

---

## 🟡 MODERATE ISSUES FOUND

### 6. No Session Validation on Phone Page
**File:** `src/pages/PhoneCameraPage.tsx`

**Issue:** Phone page doesn't validate if sessionId exists in Firestore before attempting connection.

**Risk Level:** LOW - User sees "connecting" forever
**Fix Required:** Optional - Better UX

---

### 7. QR Code API Dependency
**File:** `src/components/PhoneCameraModal.tsx`
**Line:** 22-40

**Issue:** Relies on external API `api.qrserver.com` which could be down or blocked.

**Risk Level:** LOW - Fallback shows error message
**Fix Required:** Optional - Could use client-side QR library

---

### 8. No Camera Permission Error Handling in UI
**File:** `src/pages/PhoneCameraPage.tsx`
**Line:** 106-119

**Issue:** If camera permission is denied, error is shown but no retry button or helpful message.

**Risk Level:** LOW - User can't recover without refresh
**Fix Required:** Optional - Better UX

---

## 🟢 MINOR ISSUES / IMPROVEMENTS

### 9. Console Logs in Production
**All Files**

**Issue:** Extensive console logging will remain in production build.

**Recommendation:** Use conditional logging based on environment.

---

### 10. No Maximum Phone Camera Limit
**File:** `src/utils/phoneCameraWebRTC.ts`

**Issue:** No limit on number of simultaneous phone cameras. Could overwhelm host.

**Recommendation:** Add configurable limit (e.g., 4 cameras max).

---

## 📋 TEST PLAN

### Test Suite 1: MediaStream Leak Detection

```typescript
describe('Phone Camera - MediaStream Leak Tests', () => {

  test('LEAK-01: Stream stopped when phone page unmounts', async () => {
    // 1. Navigate to phone camera page
    // 2. Grant camera permission
    // 3. Verify stream is active
    // 4. Navigate away
    // 5. Verify stream.getVideoTracks()[0].readyState === 'ended'
  });

  test('LEAK-02: Stream stopped when flipCamera is called', async () => {
    // 1. Start with back camera
    // 2. Get reference to stream
    // 3. Flip to front camera
    // 4. Verify old stream tracks are 'ended'
    // 5. Verify new stream tracks are 'live'
  });

  test('LEAK-03: All tracks stopped when connection fails', async () => {
    // 1. Start phone camera
    // 2. Simulate connection failure
    // 3. Verify all tracks are stopped
    // 4. Verify peer connection is closed
  });

  test('LEAK-04: Host cleans up stream when phone disconnects', async () => {
    // 1. Connect phone camera
    // 2. Get reference to remote stream on host
    // 3. Close phone connection
    // 4. Verify host stops the stream
    // 5. Verify layer is removed
  });

  test('LEAK-05: Multiple camera flips dont accumulate streams', async () => {
    // 1. Track MediaStream count (manual browser inspection)
    // 2. Flip camera 10 times
    // 3. Verify only 1 active stream remains
    // 4. Verify old streams are garbage collected
  });

});
```

### Test Suite 2: Peer Connection Leak Detection

```typescript
describe('Phone Camera - Peer Connection Leak Tests', () => {

  test('PC-01: Peer connection closed on page unload', async () => {
    // 1. Start phone camera
    // 2. Verify PC is open
    // 3. Trigger pagehide event
    // 4. Verify PC.connectionState === 'closed'
  });

  test('PC-02: Host closes PC when phone disconnects', async () => {
    // 1. Connect phone
    // 2. Get host PC reference
    // 3. Close phone tab
    // 4. Wait 5 seconds
    // 5. Verify host PC is closed
  });

  test('PC-03: Multiple phones create separate PCs', async () => {
    // 1. Connect phone A
    // 2. Connect phone B
    // 3. Verify 2 separate PCs on host
    // 4. Verify each has unique cameraId
  });

  test('PC-04: Stale PCs are cleaned up on reconnect', async () => {
    // 1. Connect phone with ID "abc123"
    // 2. Disconnect abruptly (kill network)
    // 3. Reconnect with same ID "abc123"
    // 4. Verify old PC is closed
    // 5. Verify new PC is created
  });

});
```

### Test Suite 3: Firestore Listener Leak Detection

```typescript
describe('Phone Camera - Firestore Listener Leak Tests', () => {

  test('FS-01: Listeners unsubscribed on phone page unmount', async () => {
    // 1. Mount phone camera page
    // 2. Count active Firestore listeners (use Firebase SDK internals)
    // 3. Unmount page
    // 4. Verify listener count decreased by expected amount
  });

  test('FS-02: Host listeners unsubscribed when stopPhoneCameraHost called', async () => {
    // 1. Start phone camera host
    // 2. Count listeners
    // 3. Call stopPhoneCameraHost()
    // 4. Verify all phone camera listeners removed
  });

  test('FS-03: Multiple mount/unmount cycles dont accumulate listeners', async () => {
    // 1. Get baseline listener count
    // 2. Mount/unmount PresenterPage 10 times
    // 3. Verify listener count returns to baseline
  });

});
```

### Test Suite 4: Race Condition Tests

```typescript
describe('Phone Camera - Race Condition Tests', () => {

  test('RACE-01: Multiple phones connecting simultaneously', async () => {
    // 1. Create 3 phones with different IDs
    // 2. Connect all at same time (Promise.all)
    // 3. Verify all 3 connections succeed
    // 4. Verify 3 separate layers created
  });

  test('RACE-02: Phone disconnects during offer/answer', async () => {
    // 1. Phone sends offer
    // 2. Immediately close phone tab
    // 3. Verify host doesn't create layer
    // 4. Verify no orphaned connections
  });

  test('RACE-03: Host stops while phone connecting', async () => {
    // 1. Phone sends offer
    // 2. Host receives offer, starts processing
    // 3. Host calls stopPhoneCameraHost()
    // 4. Verify phone connection fails gracefully
  });

  test('RACE-04: Same cameraId used twice', async () => {
    // 1. Connect phone with ID "abc123"
    // 2. Disconnect
    // 3. Reconnect with same ID "abc123"
    // 4. Verify new connection succeeds
    // 5. Verify old connection is cleaned up
  });

  test('RACE-05: Double-click "Add Phone Camera"', async () => {
    // 1. Click "Add Phone Camera" twice rapidly
    // 2. Verify only one modal opens
    // 3. Verify cameraId is consistent
  });

});
```

### Test Suite 5: Error Handling Tests

```typescript
describe('Phone Camera - Error Handling Tests', () => {

  test('ERR-01: Camera permission denied on phone', async () => {
    // 1. Mock getUserMedia to throw NotAllowedError
    // 2. Load phone camera page
    // 3. Verify error message shown
    // 4. Verify no connection attempted
  });

  test('ERR-02: Invalid session ID', async () => {
    // 1. Navigate to /phone-camera/invalid-session-id
    // 2. Verify appropriate error shown
    // 3. Verify no Firestore writes attempted
  });

  test('ERR-03: Firestore write fails on phone', async () => {
    // 1. Mock Firestore setDoc to throw error
    // 2. Attempt to publish offer
    // 3. Verify error is caught and shown to user
  });

  test('ERR-04: WebRTC connection fails (no ICE candidates)', async () => {
    // 1. Block all ICE candidates
    // 2. Attempt connection
    // 3. Verify timeout/failure shown
    // 4. Verify resources cleaned up
  });

  test('ERR-05: Network drops mid-stream', async () => {
    // 1. Establish connection
    // 2. Disable network
    // 3. Wait for timeout
    // 4. Verify phone shows disconnected state
    // 5. Verify host removes layer
  });

});
```

### Test Suite 6: Edge Case Tests

```typescript
describe('Phone Camera - Edge Case Tests', () => {

  test('EDGE-01: Phone browser refresh during streaming', async () => {
    // 1. Connect and stream
    // 2. Refresh phone browser
    // 3. Verify old connection cleaned up on host
    // 4. Verify new connection can establish
  });

  test('EDGE-02: Host goes live after phone already connected', async () => {
    // 1. Phone navigates to camera page
    // 2. Host is not live yet
    // 3. Host goes live
    // 4. Verify phone camera host starts
    // 5. Verify existing offer is processed
  });

  test('EDGE-03: Session ends while phone streaming', async () => {
    // 1. Connect phone
    // 2. Host ends session
    // 3. Verify phone shows disconnected
    // 4. Verify resources cleaned up
  });

  test('EDGE-04: Phone rotates device (orientation change)', async () => {
    // 1. Connect with portrait
    // 2. Rotate to landscape
    // 3. Verify stream continues
    // 4. Verify aspect ratio updates
  });

  test('EDGE-05: Phone app goes to background', async () => {
    // 1. Connect phone
    // 2. Switch to different app
    // 3. Verify stream pauses/stops
    // 4. Verify host handles gracefully
  });

  test('EDGE-06: Maximum simultaneous phones (10+)', async () => {
    // 1. Connect 15 phones simultaneously
    // 2. Verify all connections succeed or fail gracefully
    // 3. Verify host performance remains acceptable
  });

});
```

---

## 🔧 RECOMMENDED FIXES

### Fix 1: Add Track Ended Listener
**File:** `src/pages/PresenterPage.tsx`

```typescript
// After line 209, add:
track.addEventListener("ended", () => {
  console.log("📱 [PresenterPage] Phone camera track ended:", layerId);
  stopSource(layerId);
  useAppStore.getState().removeLayer(layerId);
});
```

### Fix 2: Add Pagehide Cleanup on Phone Page
**File:** `src/pages/PhoneCameraPage.tsx`

```typescript
// Add in useEffect, before return:
useEffect(() => {
  // ... existing code ...

  // Add pagehide listener for guaranteed cleanup
  const handlePageHide = () => {
    console.log('[PhoneCamera] Page hiding, cleaning up...');

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Stop camera stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    // Unsubscribe listeners
    unsubscribersRef.current.forEach(unsub => unsub());
  };

  window.addEventListener('pagehide', handlePageHide);

  return () => {
    window.removeEventListener('pagehide', handlePageHide);
    handlePageHide(); // Call cleanup
  };
}, []);
```

### Fix 3: Handle Duplicate Camera IDs
**File:** `src/utils/phoneCameraWebRTC.ts`

```typescript
// Replace lines 171-177 with:
const existingConn = phoneCameraConnections.get(cameraId);
if (existingConn) {
  // Check if connection is still alive
  if (existingConn.pc.connectionState === 'connected' ||
      existingConn.pc.connectionState === 'connecting') {
    console.log("⚠️ [HOST] Already have active connection for camera:", cameraId);
    return;
  } else {
    // Clean up dead connection
    console.log("🔄 [HOST] Cleaning up stale connection for camera:", cameraId);
    stopPhoneCamera(cameraId);
  }
}
```

### Fix 4: Clear Callbacks on Unmount
**File:** `src/pages/PresenterPage.tsx`

```typescript
// Modify cleanup in useEffect (around line 221):
return () => {
  // Clear callbacks before stopping host
  setPhoneCameraStreamCallback(() => {});
  setPhoneCameraDisconnectCallback(() => {});

  // Clean up phone camera host on unmount
  stopPhoneCameraHost();
};
```

### Fix 5: Add Stream Cleanup on Camera Flip
**File:** `src/pages/PhoneCameraPage.tsx`

```typescript
const flipCamera = async () => {
  const newFacing = facingMode === 'user' ? 'environment' : 'user';
  setFacingMode(newFacing);

  // Stop old stream first
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }

  const mediaStream = await startCamera(newFacing);
  if (mediaStream && pcRef.current) {
    const videoTrack = mediaStream.getVideoTracks()[0];
    const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');

    if (sender && videoTrack) {
      await sender.replaceTrack(videoTrack);
      console.log('[PhoneCamera] Camera track replaced');
    }
  }
};
```

---

## 📊 LEAK DETECTION TOOLS

### Manual Browser Testing

1. **Chrome DevTools Memory Profiler**
   - Record heap snapshot before connecting phone
   - Connect phone camera
   - Disconnect phone camera
   - Record heap snapshot after
   - Compare: Should have no new MediaStream objects

2. **Chrome Task Manager**
   - Monitor memory before/after connections
   - Should not continuously grow with connect/disconnect cycles

3. **Firefox about:memory**
   - Similar to Chrome Task Manager
   - Look for MediaStream leaks

### Automated Detection

```typescript
// Add to test setup
class LeakDetector {
  private initialStreamCount = 0;

  async captureBaseline() {
    // In real tests, this would use browser internals
    this.initialStreamCount = this.getActiveStreamCount();
  }

  async detectLeaks() {
    const currentCount = this.getActiveStreamCount();
    const leaked = currentCount - this.initialStreamCount;

    if (leaked > 0) {
      throw new Error(`Detected ${leaked} leaked MediaStreams`);
    }
  }

  private getActiveStreamCount(): number {
    // This is pseudo-code - actual implementation would need
    // to hook into browser internals or use performance APIs
    return 0;
  }
}
```

---

## ✅ QUALITY CHECKLIST

Before deploying to production:

- [ ] All CRITICAL issues fixed
- [ ] MediaStream leak tests passing
- [ ] Peer connection leak tests passing
- [ ] Firestore listener leak tests passing
- [ ] Race condition tests passing
- [ ] Error handling tests passing
- [ ] Edge case tests passing
- [ ] Manual memory profiling shows no leaks
- [ ] Tested on iOS Safari
- [ ] Tested on Android Chrome
- [ ] Tested on Desktop Chrome/Firefox
- [ ] Tested with slow network (3G simulation)
- [ ] Tested with network interruptions
- [ ] Tested with multiple simultaneous phones
- [ ] Console logs reviewed for production

---

## 📈 PERFORMANCE BENCHMARKS

Target metrics:

- **Connection establishment:** < 3 seconds
- **Video latency:** < 300ms (same network), < 800ms (different networks)
- **Memory per phone camera:** < 50MB
- **CPU per phone camera:** < 5% (on host)
- **Maximum simultaneous phones:** 4-6 without degradation

---

## 🚨 DEPLOYMENT BLOCKERS

**Must fix before production:**
1. ✅ Fix #4: Firestore Listener Leak
2. ✅ Fix #5: Missing Track Ended Listener
3. ✅ Fix #2: Pagehide cleanup

**Should fix before production:**
4. Fix #3: Race condition with duplicate camera IDs
5. Fix #1: MediaStream leak on camera flip

**Nice to have:**
6. Session validation
7. Client-side QR generation
8. Better error recovery UX
