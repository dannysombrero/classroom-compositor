# Phone Camera Feature - Testing Guide

## Quick Start Test (5 minutes)

### 1. Start the Dev Server
```bash
npm run dev
```
Note the local IP address (usually shown as `http://192.168.x.x:5173` or similar)

### 2. Open Presenter Page
- Open `http://localhost:5173` in your browser
- Click **"● Go Live"** button (top bar)
- Wait for it to say "LIVE" with a join code

### 3. Add Phone Camera
- Click **"+"** button in the Layers panel (left side)
- Click **"📱 Phone Camera..."**
- A modal with QR code should appear

### 4. Connect Your Phone
**Option A - QR Code (Easiest):**
- Open camera app on your phone
- Point at the QR code on screen
- Tap the notification to open the link

**Option B - Manual URL:**
- Click "Copy URL" in the modal
- Text/email yourself the URL
- Open on your phone

### 5. Grant Camera Permission
- Phone browser will ask for camera permission
- Tap **"Allow"**
- You should see "STREAMING" status in green
- Your phone's video feed should appear on the canvas!

### 6. Test Controls
- **Flip camera:** Tap the flip button (bottom right on phone)
- **Position/resize:** Use canvas controls on computer
- **Disconnect:** Close phone browser tab
  - Layer should disappear automatically within 5 seconds

## Expected Behavior ✅

| Action | Expected Result |
|--------|----------------|
| Phone connects | Layer appears on canvas with live video |
| Flip camera | Video switches between front/back |
| Close phone tab | Layer removed within 5 seconds |
| Refresh phone | Reconnects successfully |
| Multiple phones | Each gets its own layer |
| Old/invalid session | Shows error: "Host is not streaming yet" |

## Common Issues & Solutions

### Issue: QR Code doesn't scan
- **Solution:** Click "Copy URL" and paste in phone browser manually

### Issue: "Host is not streaming yet"
- **Solution:** Make sure you clicked "Go Live" first
- Check that session is still active (LIVE indicator showing)

### Issue: Permission denied
- **Solution:**
  - Check phone browser settings → Site permissions → Camera
  - Try in a different browser (Safari on iOS, Chrome on Android)

### Issue: Video freezes or stutters
- **Solution:**
  - Check WiFi connection strength
  - Move closer to router
  - Try on same network as computer

### Issue: No layer appears
- **Solution:**
  - Check browser console for errors (F12)
  - Verify phone shows "STREAMING" status
  - Wait 10 seconds (sometimes takes a moment)

## Network Testing

### Same WiFi (Best Performance)
1. Connect phone and computer to same WiFi
2. Expected latency: 50-200ms
3. Video should be smooth, no buffering

### Different Networks (Via TURN)
1. Use cellular data on phone
2. Expected latency: 300-800ms
3. May have slight delay, but should work

### Firewall Test (School Networks)
1. Connect to restrictive network
2. QR code should still generate (client-side)
3. Connection may need TURN server configured

## Memory Leak Testing

### Camera Flip Test
1. Connect phone camera
2. Flip camera 10 times rapidly
3. Open Chrome DevTools → Performance → Memory
4. Check for MediaStream leaks
5. **Expected:** Only 1 active stream

### Disconnect/Reconnect Test
1. Connect phone
2. Close phone tab
3. Verify layer disappears
4. Reconnect phone with same QR code
5. **Expected:** New connection succeeds

### Multiple Sessions Test
1. Go live, connect phone, end session
2. Go live again (new session)
3. Try using old QR code
4. **Expected:** Error message, not infinite loading

## Performance Benchmarks

**Target Metrics:**
- Connection time: < 3 seconds
- Latency (same WiFi): < 300ms
- CPU usage (host): < 5% per camera
- Memory: < 50MB per camera

**How to Measure:**
- Connection time: Check browser console timestamps
- Latency: Use Chrome DevTools → Network → WebRTC
- CPU: Chrome Task Manager (Shift+Esc)
- Memory: DevTools → Performance → Memory

## Edge Case Testing

### Test Case 1: Page Refresh
1. Connect phone
2. Refresh phone browser
3. **Expected:** Reconnects automatically

### Test Case 2: Host Ends Session
1. Connect phone
2. Host clicks end session
3. **Expected:** Phone shows disconnected

### Test Case 3: Network Interruption
1. Connect phone
2. Turn off WiFi on phone for 5 seconds
3. Turn WiFi back on
4. **Expected:** Reconnects or shows error

### Test Case 4: Orientation Change
1. Connect phone
2. Rotate phone (portrait ↔ landscape)
3. **Expected:** Stream continues, aspect updates

### Test Case 5: Background Tab
1. Connect phone
2. Switch to different app on phone
3. **Expected:** Stream pauses or stops gracefully

## Browser Compatibility

**Recommended:**
- ✅ iOS Safari 14+
- ✅ Chrome (Android) 90+
- ✅ Desktop Chrome/Edge

**Known Issues:**
- ⚠️ iOS Safari < 14: May have autoplay issues
- ⚠️ Firefox Android: Camera flip may not work on all devices

## Production Checklist

Before deploying to production:
- [ ] Test on iOS Safari (most common)
- [ ] Test on Android Chrome
- [ ] Test on school WiFi network
- [ ] Test with cellular data
- [ ] Test camera flip works
- [ ] Test disconnect/reconnect
- [ ] Verify no memory leaks (flip camera 10x)
- [ ] Verify no console errors
- [ ] Test with multiple phones (if relevant)
- [ ] Test QR code generates without external API

## Troubleshooting Commands

**Check active connections:**
```javascript
// In browser console on host
// (requires adding debug helper)
```

**Force cleanup:**
```javascript
// Refresh page to reset everything
```

**Check Firestore rules:**
```bash
# Verify session documents can be read
firebase firestore:get sessions/{sessionId}/host_ready/status
```
