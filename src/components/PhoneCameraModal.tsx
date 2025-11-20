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
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;

    // Generate QR code directly on canvas
    QRCode.toCanvas(canvas, phoneCameraUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    }).catch((err) => {
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
  }, [isOpen, phoneCameraUrl]);

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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Connect Phone Camera</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="border-4 border-gray-200 rounded-lg p-2 bg-white">
              <canvas
                ref={canvasRef}
                className="block"
              />
            </div>
          </div>

          {/* Instructions */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              Scan this QR code with your phone camera, or copy the URL below
            </p>
          </div>

          {/* URL */}
          <div className="bg-gray-100 rounded-lg p-3">
            <p className="text-xs font-mono text-gray-700 break-all">
              {phoneCameraUrl}
            </p>
          </div>

          {/* Copy Button */}
          <button
            onClick={copyUrl}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Copy URL
          </button>

          {/* Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">Tips:</h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Make sure your phone is on the same WiFi network for best quality</li>
              <li>• Use a phone stand to keep the camera steady</li>
              <li>• You can flip between front and back camera on the phone</li>
              <li>• Keep the phone page open while streaming</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
