/**
 * Monitor Detection Test Utilities
 *
 * Functions to test and validate monitor detection functionality.
 */

import { detectMonitors, isWindowManagementSupported, type MonitorDetectionResult } from './monitorDetection';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  data?: any;
}

/**
 * Test if Window Management API is supported in this browser
 */
export async function testAPISupport(): Promise<TestResult> {
  const supported = isWindowManagementSupported();

  return {
    name: 'Window Management API Support',
    passed: supported,
    message: supported
      ? 'Window Management API is available in this browser'
      : 'Window Management API not available - will use fallback detection',
    data: {
      supported,
      userAgent: navigator.userAgent,
    },
  };
}

/**
 * Test basic monitor detection
 */
export async function testBasicDetection(): Promise<TestResult> {
  const result = await detectMonitors();

  if (!result) {
    return {
      name: 'Basic Monitor Detection',
      passed: false,
      message: 'Detection returned null - this should not happen',
    };
  }

  return {
    name: 'Basic Monitor Detection',
    passed: true,
    message: `Detected ${result.screenCount} monitor(s) using ${result.supported ? 'Window Management API' : 'Fallback'}`,
    data: {
      screenCount: result.screenCount,
      isExtended: result.isExtended,
      supported: result.supported,
    },
  };
}

/**
 * Test screen information accuracy
 */
export async function testScreenInfo(): Promise<TestResult> {
  const result = await detectMonitors();

  if (!result || result.screens.length === 0) {
    return {
      name: 'Screen Information',
      passed: false,
      message: 'No screens detected',
    };
  }

  const hasLabels = result.screens.every(s => s.label && s.label.length > 0);
  const hasResolutions = result.screens.every(s => s.width > 0 && s.height > 0);
  const hasPrimary = result.screens.some(s => s.isPrimary);

  const issues: string[] = [];
  if (!hasLabels) issues.push('some screens missing labels');
  if (!hasResolutions) issues.push('some screens have invalid resolutions');
  if (!hasPrimary) issues.push('no primary screen detected');

  return {
    name: 'Screen Information Validation',
    passed: issues.length === 0,
    message: issues.length === 0
      ? `All ${result.screens.length} screen(s) have valid information`
      : `Issues: ${issues.join(', ')}`,
    data: {
      screens: result.screens.map(s => ({
        label: s.label,
        resolution: `${s.width}x${s.height}`,
        isPrimary: s.isPrimary,
        isInternal: s.isInternal,
      })),
    },
  };
}

/**
 * Test delayed vs immediate activation logic
 */
export async function testActivationLogic(): Promise<TestResult> {
  const result = await detectMonitors();

  if (!result) {
    return {
      name: 'Activation Logic',
      passed: false,
      message: 'Cannot test - no detection result',
    };
  }

  const shouldDelay = result.screenCount < 3;
  const mode = shouldDelay ? 'delayed' : 'immediate';
  const reason = shouldDelay
    ? '1-2 monitors detected - will use delayed activation to prevent feedback loop'
    : '3+ monitors detected - can use immediate activation';

  return {
    name: 'Screen Share Activation Logic',
    passed: true,
    message: `Screen share mode: ${mode} (${reason})`,
    data: {
      screenCount: result.screenCount,
      shouldDelay,
      mode,
    },
  };
}

/**
 * Test permission state (if API is supported)
 */
export async function testPermissionState(): Promise<TestResult> {
  if (!isWindowManagementSupported()) {
    return {
      name: 'Permission State',
      passed: true,
      message: 'N/A - Window Management API not supported',
    };
  }

  try {
    // Try to check permission without prompting
    if ('permissions' in navigator && 'query' in navigator.permissions) {
      const permission = await navigator.permissions.query({ name: 'window-management' as any });
      return {
        name: 'Permission State',
        passed: true,
        message: `Window Management permission: ${permission.state}`,
        data: {
          state: permission.state,
        },
      };
    }
  } catch (error) {
    // Permission API might not support window-management query
  }

  return {
    name: 'Permission State',
    passed: true,
    message: 'Permission state check not available - will prompt on first use',
  };
}

/**
 * Run all tests and return results
 */
export async function runAllTests(): Promise<TestResult[]> {
  console.log('🧪 [Monitor Detection Tests] Running all tests...');

  const results: TestResult[] = [];

  // Run tests sequentially
  results.push(await testAPISupport());
  results.push(await testPermissionState());
  results.push(await testBasicDetection());
  results.push(await testScreenInfo());
  results.push(await testActivationLogic());

  // Log results
  console.log('🧪 [Monitor Detection Tests] Results:');
  results.forEach((result, idx) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`  ${icon} ${result.name}: ${result.message}`);
    if (result.data) {
      console.log('     Data:', result.data);
    }
  });

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`🧪 [Monitor Detection Tests] ${passed}/${total} tests passed`);

  return results;
}

/**
 * Log current detection state to console in a formatted way
 */
export async function logDetectionState(): Promise<void> {
  const result = await detectMonitors();

  if (!result) {
    console.log('🖥️ [Monitor Detection] No result');
    return;
  }

  console.log('🖥️ [Monitor Detection State]');
  console.log('├─ API Support:', result.supported ? 'Window Management API' : 'Fallback');
  console.log('├─ Screen Count:', result.screenCount);
  console.log('├─ Extended Display:', result.isExtended);
  console.log('├─ Screen Share Mode:', result.screenCount < 3 ? 'Delayed' : 'Immediate');
  console.log('└─ Screens:');

  result.screens.forEach((screen, idx) => {
    const isLast = idx === result.screens.length - 1;
    const prefix = isLast ? '   └─' : '   ├─';
    const icon = screen.isPrimary ? '🖥️' : '💻';
    const tags = [
      screen.isPrimary ? 'Primary' : null,
      screen.isInternal ? 'Internal' : null,
    ].filter(Boolean).join(', ');

    console.log(`${prefix} ${icon} ${screen.label} (${screen.width}×${screen.height}) ${tags ? `[${tags}]` : ''}`);
  });
}
