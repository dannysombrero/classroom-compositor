/**
 * PresenterPage component - main editing interface with canvas and overlay panel.
 * 
 * Mounts the PresenterCanvas and provides space for the overlay panel with
 * visibility toggles and layer controls.
 */

import { PresenterCanvas } from '../components/PresenterCanvas';

/**
 * Main presenter page component.
 * 
 * @returns Layout with canvas and overlay panel placeholder
 */
export function PresenterPage() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
      }}
    >
      {/* Main canvas area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <PresenterCanvas width={1920} height={1080} fitToContainer />
      </div>

      {/* Overlay panel placeholder */}
      <div
        style={{
          width: '300px',
          backgroundColor: '#2a2a2a',
          borderLeft: '1px solid #3a3a3a',
          padding: '16px',
          overflowY: 'auto',
        }}
      >
        {/* TODO: Overlay panel component with visibility toggles */}
        <div style={{ color: '#fff', fontSize: '14px' }}>
          Overlay Panel (placeholder)
        </div>
      </div>
    </div>
  );
}

