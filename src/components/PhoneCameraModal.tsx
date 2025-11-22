/**
 * PhoneCameraModal - Shows QR code and URL for connecting a phone camera
 */

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface PhoneCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  cameraId: string;
}

export function PhoneCameraModal({ isOpen, onClose, sessionId, cameraId }: PhoneCameraModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const phoneCameraUrl = `${window.location.origin}/phone-camera/${sessionId}?cameraId=${cameraId}`;

  // Generate QR code on canvas (client-side, no external API)
  useEffect(() => {
    if (!isOpen || !canvasRef.current || !sessionId || !cameraId) return;

    const canvas = canvasRef.current;

    // Generate QR code directly on canvas
    QRCode.toCanvas(canvas, phoneCameraUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    }).catch((err: Error) => {
      console.error('[PhoneCameraModal] Failed to generate QR code:', err);

      // Fallback: draw error message on canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 300;
        canvas.height = 300;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 300, 300);
        ctx.fillStyle = '#000';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('QR Code', 150, 140);
        ctx.fillText('Generation', 150, 160);
        ctx.fillText('Failed', 150, 180);
      }
    });
  }, [isOpen, phoneCameraUrl, sessionId, cameraId]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(phoneCameraUrl);
      alert('URL copied to clipboard!');
    } catch (err) {
      // Fallback
      window.prompt('Copy this URL:', phoneCameraUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1a1a24',
          borderRadius: 12,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          padding: 24,
          maxWidth: 420,
          width: '90%',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: 0 }}>
            📱 Connect Phone Camera
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: 24,
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* QR Code */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            border: '4px solid #fff',
            borderRadius: 8,
            padding: 8,
            backgroundColor: '#fff',
          }}>
            <canvas
              ref={canvasRef}
              style={{ display: 'block' }}
            />
          </div>
        </div>

        {/* Instructions */}
        <p style={{
          textAlign: 'center',
          fontSize: 14,
          color: 'rgba(255, 255, 255, 0.7)',
          marginBottom: 16,
        }}>
          Scan this QR code with your phone camera, or copy the URL below
        </p>

        {/* URL */}
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}>
          <p style={{
            fontSize: 11,
            fontFamily: 'monospace',
            color: 'rgba(255, 255, 255, 0.8)',
            wordBreak: 'break-all',
            margin: 0,
          }}>
            {phoneCameraUrl}
          </p>
        </div>

        {/* Copy Button */}
        <button
          onClick={copyUrl}
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          📋 Copy URL
        </button>

        {/* Tips */}
        <div style={{
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 8,
          padding: 12,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa', marginTop: 0, marginBottom: 8 }}>
            💡 Tips:
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6 }}>
            <li>Make sure your phone is on the same WiFi network</li>
            <li>Use a phone stand to keep the camera steady</li>
            <li>You can flip between front and back camera</li>
            <li>Keep the phone page open while streaming</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
