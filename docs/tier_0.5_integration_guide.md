# Tier 0.5 Integration Guide

**Goal:** Add AI Lesson Helper to your presenter workflow so teachers can set up custom bot questions before sessions.

## Quick Start

### 1. Import Components

```typescript
import {
  LessonHelperPanel,
  getSessionAIConfig,
  startBotsWithAIQuestions,
  startBot,
  ENGAGEMENT_BOT,
  ENCOURAGEMENT_BOT,
  CHECK_IN_BOT,
} from './ai';
```

### 2. Add State to PresenterPage

```typescript
const [showLessonSetup, setShowLessonSetup] = useState(false);
const [aiConfig, setAIConfig] = useState<SessionAIConfig | null>(null);
```

### 3. Load AI Config on Session Start

```typescript
const handleStartSession = useCallback(async () => {
  // ... existing session setup code ...

  // Check for existing AI config
  const config = await getSessionAIConfig(sessionId);
  if (config?.aiQuestions?.length > 0) {
    setAIConfig(config);
    console.log('✅ Loaded AI config with', config.aiQuestions.length, 'questions');
  } else {
    // Show setup modal
    setShowLessonSetup(true);
  }
}, [sessionId]);
```

### 4. Start Bots with AI Questions

```typescript
const handleGoLive = useCallback(async () => {
  // ... existing go live code ...

  // Start bots with AI questions or fallback to Tier 0
  if (aiConfig?.aiQuestions && aiConfig.aiQuestions.length > 0) {
    console.log('🤖 [Tier 0.5] Starting bots with AI questions');
    await startBotsWithAIQuestions(sessionId, aiConfig.aiQuestions);
  } else {
    console.log('🤖 [Tier 0] Starting bots with default messages');
    startBot(sessionId, ENGAGEMENT_BOT);
    startBot(sessionId, ENCOURAGEMENT_BOT);
    startBot(sessionId, CHECK_IN_BOT);
  }

  // ... rest of go live code ...
}, [sessionId, aiConfig]);
```

### 5. Render Lesson Setup Modal

```tsx
{showLessonSetup && (
  <div style={{
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  }}>
    <LessonHelperPanel
      sessionId={sessionId}
      onComplete={(keywords, questions) => {
        setAIConfig({ aiKeywords: keywords, aiQuestions: questions });
        setShowLessonSetup(false);
        console.log('✅ AI setup complete!');
      }}
      onCancel={() => {
        setShowLessonSetup(false);
        console.log('⏩ Skipped AI setup');
      }}
    />
  </div>
)}
```

## Complete Integration Example

Here's a complete example showing all the integration points:

```typescript
function PresenterPage() {
  const [sessionId] = useState(() => createId('session'));
  const [showLessonSetup, setShowLessonSetup] = useState(false);
  const [aiConfig, setAIConfig] = useState<SessionAIConfig | null>(null);
  const [streamingStatus, setStreamingStatus] = useState<'idle' | 'live' | 'paused'>('idle');

  // =========================================================================
  // Session Start - Check for AI Config
  // =========================================================================

  const handleStartSession = useCallback(async () => {
    console.log('🎬 [START SESSION] Creating room...');

    try {
      // 1. Create session
      await ensureSessionExists(sessionId);

      // 2. Check for existing AI config
      const config = await getSessionAIConfig(sessionId);
      if (config?.aiQuestions?.length > 0) {
        setAIConfig(config);
        console.log(`✅ Loaded ${config.aiQuestions.length} AI questions`);
      } else {
        // No AI config - show setup modal
        setShowLessonSetup(true);
      }

      // 3. Open viewer, activate join code, etc.
      openViewer();
      await activateJoinCode(sessionId);

      console.log('✅ Session started');
    } catch (error) {
      console.error('❌ Failed to start session:', error);
    }
  }, [sessionId]);

  // =========================================================================
  // Go Live - Start Bots with AI Questions
  // =========================================================================

  const handleGoLive = useCallback(async () => {
    console.log('🔴 [GO LIVE] Starting stream...');

    try {
      // 1. Start WebRTC
      await goLive(HOST_ID);

      // 2. Start bots with AI questions (or fallback)
      if (aiConfig?.aiQuestions && aiConfig.aiQuestions.length > 0) {
        console.log('🤖 [Tier 0.5] Starting bots with AI questions');
        await startBotsWithAIQuestions(sessionId, aiConfig.aiQuestions);
      } else {
        console.log('🤖 [Tier 0] Starting bots with default messages');
        startBot(sessionId, ENGAGEMENT_BOT);
        startBot(sessionId, ENCOURAGEMENT_BOT);
        startBot(sessionId, CHECK_IN_BOT);
      }

      // 3. Switch to console view
      setStreamingStatus('live');
      setCompactPresenter(true);

      console.log('✅ Live!');
    } catch (error) {
      console.error('❌ Failed to go live:', error);
    }
  }, [sessionId, aiConfig]);

  // =========================================================================
  // Lesson Setup Handlers
  // =========================================================================

  const handleLessonSetupComplete = (keywords: string[], questions: string[]) => {
    setAIConfig({
      aiKeywords: keywords,
      aiQuestions: questions,
      approvedAt: Date.now(),
    });
    setShowLessonSetup(false);
    console.log('✅ AI setup complete:', { keywords, questions });
  };

  const handleSkipLessonSetup = () => {
    setShowLessonSetup(false);
    console.log('⏩ Skipped AI setup - will use Tier 0 fallback');
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {/* Main presenter UI */}
      <PresenterCanvas />

      {/* Control buttons */}
      <div style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8 }}>
        {streamingStatus === 'idle' && !joinCode && (
          <button onClick={handleStartSession}>
            ▶️ Start Session
          </button>
        )}

        {streamingStatus === 'idle' && joinCode && (
          <button onClick={handleGoLive}>
            🔴 Go Live
          </button>
        )}
      </div>

      {/* Lesson Setup Modal */}
      {showLessonSetup && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: 20,
        }}>
          <LessonHelperPanel
            sessionId={sessionId}
            onComplete={handleLessonSetupComplete}
            onCancel={handleSkipLessonSetup}
          />
        </div>
      )}

      {/* AI Config Status (optional) */}
      {aiConfig && (
        <div style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          background: 'rgba(147, 51, 234, 0.2)',
          border: '1px solid rgba(147, 51, 234, 0.4)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12,
          color: '#c084fc',
        }}>
          ✅ AI Setup: {aiConfig.aiQuestions?.length || 0} questions ready
        </div>
      )}
    </div>
  );
}
```

## Flow Diagram

```
User clicks "Start Session"
    ↓
Check for existing AI config
    ↓
    ├─ Has AI config → Load questions → Ready
    └─ No AI config  → Show LessonHelperPanel
                           ↓
                Teacher completes setup (or skips)
                           ↓
                     Questions saved
                           ↓
User clicks "Go Live"
    ↓
Start bots with AI questions (or Tier 0 fallback)
    ↓
Bots ask relevant questions during session
```

## Key Features

### Auto-load Existing Config
```typescript
// If teacher already set up AI for this session, load it
const config = await getSessionAIConfig(sessionId);
```

### Graceful Fallback
```typescript
// If no AI config, use Tier 0 default messages
if (!aiConfig) {
  startBot(sessionId, ENGAGEMENT_BOT);
}
```

### Skip Option
```typescript
// Teacher can skip AI setup and use defaults
onCancel={() => setShowLessonSetup(false)}
```

### Edit Later
```typescript
// Add button to re-open setup modal
<button onClick={() => setShowLessonSetup(true)}>
  ✏️ Edit AI Questions
</button>
```

## Best Practices

### 1. Show Setup BEFORE Session Starts
✅ **Good:** Show modal after "Start Session" but before "Go Live"
❌ **Bad:** Show during live stream

### 2. Allow Skip
✅ **Good:** Provide "Cancel" or "Skip" button
❌ **Bad:** Force teacher to complete setup

### 3. Persist Across Sessions
✅ **Good:** Load existing config if available
❌ **Bad:** Make teacher re-enter every time

### 4. Show Status
✅ **Good:** Display "X questions ready" indicator
❌ **Bad:** No visibility into what's configured

### 5. Test Fallback
✅ **Good:** Ensure Tier 0 works if AI fails
❌ **Bad:** Hard failure when AI unavailable

## Testing Checklist

- [ ] Start session with no AI config → shows modal
- [ ] Complete AI setup → saves to Firestore
- [ ] Start session again → loads existing config
- [ ] Skip setup → uses Tier 0 fallback
- [ ] Go live with AI questions → bots use custom questions
- [ ] Go live without AI → bots use default messages
- [ ] Edit button re-opens modal
- [ ] Cancel during setup → returns to normal flow

## Troubleshooting

### Modal doesn't show
- Check `showLessonSetup` state
- Ensure z-index is high enough (10000+)
- Verify sessionId exists

### Bots use wrong questions
- Check console logs for Tier 0 vs 0.5 indicators
- Verify `aiConfig.aiQuestions` has content
- Ensure `startBotsWithAIQuestions` is called

### AI config not persisting
- Check Firestore rules allow writes
- Verify sessionId is consistent
- Check browser console for errors

## Next Steps

1. Add to your PresenterPage using the example above
2. Test the full flow (setup → save → load → bots)
3. Customize styling to match your design
4. Add "Edit Questions" button for iterating
5. Consider adding loading states during AI generation

## Additional Resources

- Full component: `src/examples/Tier05Integration.tsx`
- API docs: `docs/tier_0.5_implementation.md`
- Test suite: `src/ai/bots/tier0.test.ts`
