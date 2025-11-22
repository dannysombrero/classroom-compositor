/**
 * ViewerHostPage component - displays the composited output in a separate viewer window.
 * 
 * Receives canvas.captureStream(30) via postMessage and renders it in a full-bleed video element.
 */

import { useEffect, useRef } from 'react';

/**
 * Viewer page component for the second window that displays the presentation output.
 * 
 * @returns Video element ready for stream input
 */
export function ViewerHostPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sourceStreamRef = useRef<MediaStream | null>(null);
  const playbackStreamRef = useRef<MediaStream | null>(null);
  const isSettingStreamRef = useRef<boolean>(false);

  const stopPlaybackStream = () => {
    // NOTE: We no longer clone, so we don't need to stop tracks here.
    // The presenter manages the source stream lifecycle.
    // Just clear the reference.
    if (playbackStreamRef.current) {
      console.log('[VIEWER-CLEANUP] Clearing playback stream reference (not stopping - presenter manages)');
      playbackStreamRef.current = null;
    }
  };

  useEffect(() => {
    console.log('Viewer: Setting up message listener');
    
    const video = videoRef.current;
    if (video) {
      // Set up video event listeners once
      video.addEventListener('loadedmetadata', () => {
        console.log('Viewer: Video metadata loaded', {
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
      });
      
      video.addEventListener('playing', () => {
        console.log('Viewer: Video is now playing!', {
          readyState: video.readyState,
          currentTime: video.currentTime,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
      });
      
      video.addEventListener('play', () => {
        console.log('Viewer: Video play event fired', {
          readyState: video.readyState,
          currentTime: video.currentTime,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
      });
      
      video.addEventListener('error', (e) => {
        console.error('Viewer: Video error:', e, video.error);
      });
    }
    
    const handleMessage = (event: MessageEvent) => {
      console.log('Viewer: Received message', event.data, 'from origin', event.origin);
      
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) {
        console.warn('Viewer: Rejecting message from different origin:', event.origin);
        return;
      }

      const video = videoRef.current;
      if (!video) {
        console.warn('Viewer: Video element not available');
        return;
      }

      if (event.data?.type === 'stream') {
        console.log('Viewer: Received stream message', event.data);
        
        let stream: MediaStream | null = null;
        
        // Try to get stream from the message (might work if browser allows reference sharing)
        if (event.data.stream && event.data.stream instanceof MediaStream) {
          stream = event.data.stream;
          console.log('Viewer: Got stream directly from message');
        }
        
        // If no stream in message and we don't already have one, request it from opener
        if (!stream && !sourceStreamRef.current && window.opener && !isSettingStreamRef.current) {
          console.log('Viewer: Requesting stream from opener');
          window.opener.postMessage({ type: 'request-stream' }, window.location.origin);
        }
        
        // Also try to get it from opener's global if available
        if (!stream && window.opener) {
          try {
            // @ts-ignore - accessing function/property from opener's context
            const openerWindow = window.opener as any;
            
            // Try direct property access first
            if (openerWindow.currentStream) {
              const retrievedStream = openerWindow.currentStream;
              console.log('Viewer: Got stream from opener.currentStream:', {
                isNull: retrievedStream === null,
                hasGetVideoTracks: typeof retrievedStream?.getVideoTracks === 'function',
                hasTracks: retrievedStream?.getVideoTracks?.()?.length || 0,
                streamType: typeof retrievedStream,
              });
              // Check if it has MediaStream-like interface instead of instanceof
              if (retrievedStream && typeof retrievedStream.getVideoTracks === 'function') {
                stream = retrievedStream as MediaStream;
                console.log('Viewer: Using stream from opener.currentStream');
              }
            }
            
            // Fallback to function
            if (!stream && openerWindow.getCurrentStream && typeof openerWindow.getCurrentStream === 'function') {
              const retrievedStream = openerWindow.getCurrentStream();
              console.log('Viewer: Got stream from opener.getCurrentStream():', {
                isNull: retrievedStream === null,
                hasGetVideoTracks: typeof retrievedStream?.getVideoTracks === 'function',
                hasTracks: retrievedStream?.getVideoTracks?.()?.length || 0,
                streamType: typeof retrievedStream,
              });
              // Check if it has MediaStream-like interface instead of instanceof
              if (retrievedStream && typeof retrievedStream.getVideoTracks === 'function') {
                stream = retrievedStream as MediaStream;
                console.log('Viewer: Using stream from opener.getCurrentStream()');
              }
            }
          } catch (e) {
            console.warn('Viewer: Could not access stream from opener:', e);
          }
        }
        
        // Check if stream is valid (has MediaStream interface)
        if (stream && typeof stream.getVideoTracks === 'function') {
          // Only set stream if it's different from current one
          if (sourceStreamRef.current === stream) {
            console.log('Viewer: Same source stream, skipping clone');
            return;
          }

          isSettingStreamRef.current = true;
          sourceStreamRef.current = stream;

          const tracks = stream.getVideoTracks();
          console.log('Viewer: Setting video srcObject, tracks:', tracks.length);
          if (tracks.length > 0) {
            console.log('Viewer: Video track details:', {
              id: tracks[0].id,
              kind: tracks[0].kind,
              enabled: tracks[0].enabled,
              readyState: tracks[0].readyState,
              muted: tracks[0].muted,
              settings: tracks[0].getSettings?.() ?? null,
            });
          }

          // CHANGED: Use source stream directly instead of cloning
          // This avoids creating extra streams that need cleanup
          stopPlaybackStream();
          console.log('[VIEWER-STREAM] Using source stream directly (no clone)', {
            streamId: stream.id,
            tracks: stream.getTracks().map(t => ({ id: t.id, type: t.constructor.name }))
          });

          video.srcObject = stream;
          video
            .play()
            .then(() => {
              console.log('Viewer: Stream playing successfully');
              isSettingStreamRef.current = false;
            })
            .catch((error) => {
              // AbortError is expected if we're switching streams, ignore it
              if (error.name !== 'AbortError') {
                console.error('Viewer: Failed to play stream:', error);
              } else {
                console.log('Viewer: Play interrupted (stream switch), will retry');
                // Retry after a brief delay
                setTimeout(() => {
                  if (video.srcObject === stream) {
                    video.play()
                      .then(() => {
                        console.log('Viewer: Stream playing successfully (after retry)');
                      })
                      .catch(e => {
                        if (e.name !== 'AbortError') {
                          console.error('Viewer: Retry play failed:', e);
                        }
                      });
                  }
                }, 100);
              }
              isSettingStreamRef.current = false;
            });
        } else {
          console.warn('Viewer: No valid stream available. Stream:', stream);
          // Only retry if we don't have a stream at all
          if (!sourceStreamRef.current && window.opener && !isSettingStreamRef.current) {
            setTimeout(() => {
              if (!sourceStreamRef.current) {
                window.opener!.postMessage({ type: 'request-stream' }, window.location.origin);
              }
            }, 1000);
          }
        }
      } else if (event.data?.type === 'stream-ended') {
        // Stream ended, show placeholder or message
        stopPlaybackStream();
        sourceStreamRef.current = null;
        video.srcObject = null;
        console.log('Viewer: Stream ended');
      } else if (event.data?.type === 'viewer-ready') {
        console.log('Viewer: Received viewer-ready message');
      } else if (event.data?.type === 'handshake') {
        // Respond to handshake - parent window will resend stream if needed
        console.log('Viewer: Responding to handshake');
        if (window.opener) {
          window.opener.postMessage({ type: 'viewer-ready' }, window.location.origin);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Send handshake to parent window if opened via window.open
    if (window.opener) {
      console.log('Viewer: Sending initial handshake to opener');
      window.opener.postMessage({ type: 'viewer-ready' }, window.location.origin);
    } else {
      console.warn('Viewer: No window.opener found');
    }

    // CRITICAL: Add beforeunload to ensure cleanup when window is force-closed
    const handleBeforeUnload = () => {
      console.log('[VIEWER-UNLOAD] Window closing, cleaning up streams');
      stopPlaybackStream();
      sourceStreamRef.current = null;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      console.log('[VIEWER-UNMOUNT] Cleanup running');
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      stopPlaybackStream();
      sourceStreamRef.current = null;
      console.log('[VIEWER-UNMOUNT] Cleanup complete');
    };
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}
