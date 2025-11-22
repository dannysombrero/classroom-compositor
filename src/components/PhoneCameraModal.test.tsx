/**
 * PhoneCameraModal Component Tests
 *
 * Tests for the phone camera connection modal including:
 * - QR code generation
 * - URL generation
 * - Copy functionality
 * - Modal visibility
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PhoneCameraModal } from './PhoneCameraModal';

// Mock qrcode
vi.mock('qrcode', () => ({
  default: {
    toCanvas: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

// Mock window.alert
vi.spyOn(window, 'alert').mockImplementation(() => {});

describe('PhoneCameraModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    sessionId: 'test-session-123',
    cameraId: 'cam-abc-456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Visibility', () => {
    it('should render when isOpen is true', () => {
      render(<PhoneCameraModal {...defaultProps} />);
      const title = screen.queryByText('Connect Phone Camera');
      expect(title).not.toBeNull();
    });

    it('should not render when isOpen is false', () => {
      render(<PhoneCameraModal {...defaultProps} isOpen={false} />);
      const title = screen.queryByText('Connect Phone Camera');
      expect(title).toBeNull();
    });
  });

  describe('URL Generation', () => {
    it('should display URL with correct session and camera IDs', () => {
      render(<PhoneCameraModal {...defaultProps} />);

      const expectedUrl = `${window.location.origin}/phone-camera/test-session-123?cameraId=cam-abc-456`;
      const urlElements = screen.queryAllByText(expectedUrl);
      expect(urlElements.length).toBeGreaterThan(0);
    });
  });

  describe('Copy Functionality', () => {
    it('should have a Copy URL button', () => {
      render(<PhoneCameraModal {...defaultProps} />);
      const button = screen.queryByText('Copy URL');
      expect(button).not.toBeNull();
    });

    it('should copy URL to clipboard when button clicked', async () => {
      render(<PhoneCameraModal {...defaultProps} />);

      const copyButton = screen.getByText('Copy URL');
      await fireEvent.click(copyButton);

      const expectedUrl = `${window.location.origin}/phone-camera/test-session-123?cameraId=cam-abc-456`;
      expect(mockWriteText).toHaveBeenCalledWith(expectedUrl);
    });
  });

  describe('Close Behavior', () => {
    it('should call onClose when backdrop clicked', () => {
      const onClose = vi.fn();
      render(<PhoneCameraModal {...defaultProps} onClose={onClose} />);

      // Click on the backdrop (the outer div with fixed class)
      const backdrop = document.querySelector('.fixed.inset-0');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  describe('Tips Section', () => {
    it('should display helpful tips', () => {
      render(<PhoneCameraModal {...defaultProps} />);

      const tips = screen.queryByText('Tips:');
      expect(tips).not.toBeNull();

      const wifiTip = screen.queryByText(/same WiFi network/);
      expect(wifiTip).not.toBeNull();
    });
  });

  describe('QR Code', () => {
    it('should render canvas element for QR code', () => {
      render(<PhoneCameraModal {...defaultProps} />);

      const canvas = document.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });
  });
});
