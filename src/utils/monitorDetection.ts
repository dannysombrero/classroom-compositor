/**
 * Monitor detection utility using Window Management API
 * Detects number of screens and provides detailed screen information
 */

export interface ScreenInfo {
  id: string;
  label: string;
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  left: number;
  top: number;
  isPrimary: boolean;
  isInternal: boolean;
}

export interface MonitorDetectionResult {
  supported: boolean;
  screenCount: number;
  isExtended: boolean;
  screens: ScreenInfo[];
  primary: ScreenInfo | null;
}

/**
 * Check if Window Management API is supported
 */
export function isWindowManagementSupported(): boolean {
  return 'getScreenDetails' in window;
}

/**
 * Request permission for Window Management API
 * Note: This requires a user gesture (click, etc.)
 */
export async function requestScreensPermission(): Promise<boolean> {
  if (!isWindowManagementSupported()) {
    console.warn('[Monitor Detection] Window Management API not supported');
    return false;
  }

  try {
    const screenDetails = await (window as any).getScreenDetails();
    return screenDetails.screens.length > 0;
  } catch (error) {
    console.error('[Monitor Detection] Permission denied or error:', error);
    return false;
  }
}

/**
 * Detect monitors and return detailed screen information
 * Returns null if API is not supported or permission is denied
 */
export async function detectMonitors(): Promise<MonitorDetectionResult | null> {
  if (!isWindowManagementSupported()) {
    console.log('[Monitor Detection] Window Management API not supported - using fallback');
    return getFallbackDetection();
  }

  try {
    const screenDetails = await (window as any).getScreenDetails();
    const screens: ScreenInfo[] = screenDetails.screens.map((screen: any, index: number) => ({
      id: `screen-${index}`,
      label: screen.label || `Display ${index + 1}`,
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      left: screen.left,
      top: screen.top,
      isPrimary: screen.isPrimary || false,
      isInternal: screen.isInternal || false,
    }));

    const primary = screens.find(s => s.isPrimary) || screens[0] || null;

    return {
      supported: true,
      screenCount: screens.length,
      isExtended: screenDetails.screens.length > 1,
      screens,
      primary,
    };
  } catch (error) {
    console.error('[Monitor Detection] Error detecting monitors:', error);
    return getFallbackDetection();
  }
}

/**
 * Fallback detection when Window Management API is unavailable
 * Uses basic screen API - can only detect the current screen
 */
function getFallbackDetection(): MonitorDetectionResult {
  const currentScreen = window.screen;
  const screenInfo: ScreenInfo = {
    id: 'screen-0',
    label: 'Current Display',
    width: currentScreen.width,
    height: currentScreen.height,
    availWidth: currentScreen.availWidth,
    availHeight: currentScreen.availHeight,
    left: 0,
    top: 0,
    isPrimary: true,
    isInternal: false,
  };

  return {
    supported: false,
    screenCount: 1,
    isExtended: false,
    screens: [screenInfo],
    primary: screenInfo,
  };
}

/**
 * Determine if delayed screen share should be used based on monitor count
 * @param screenCount Number of detected screens
 * @returns true if should use delayed activation (1-2 monitors), false for immediate (3+)
 */
export function shouldUseDelayedScreenShare(screenCount: number): boolean {
  return screenCount < 3;
}

/**
 * Get a user-friendly description of the monitor setup
 */
export function getMonitorSetupDescription(result: MonitorDetectionResult): string {
  if (!result.supported) {
    return 'Unable to detect monitors (using fallback)';
  }

  if (result.screenCount === 1) {
    return '1 monitor detected';
  }

  const internal = result.screens.find(s => s.isInternal);
  if (internal && result.screenCount === 2) {
    return `Laptop + 1 external monitor`;
  }

  return `${result.screenCount} monitors detected`;
}

/**
 * Listen for screen changes (added/removed monitors)
 * Returns cleanup function
 */
export function onScreenChange(callback: () => void): () => void {
  if (!isWindowManagementSupported()) {
    return () => {}; // No-op cleanup
  }

  let screenDetails: any = null;

  const init = async () => {
    try {
      screenDetails = await (window as any).getScreenDetails();
      screenDetails.addEventListener('screenschange', callback);
    } catch (error) {
      console.warn('[Monitor Detection] Could not listen for screen changes:', error);
    }
  };

  init();

  return () => {
    if (screenDetails) {
      screenDetails.removeEventListener('screenschange', callback);
    }
  };
}
