/**
 * Hook for managing UI layout state in the presenter view.
 * Handles panels, modals, and presentation modes.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export function usePresenterLayout() {
  const [panelPosition, setPanelPosition] = useState({ x: 24, y: 24 });
  const [isLayersPanelCollapsed, setLayersPanelCollapsed] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isConfidencePreviewVisible, setIsConfidencePreviewVisible] = useState(false);
  const [controlStripVisible, setControlStripVisible] = useState(true);
  const controlStripTimerRef = useRef<number | null>(null);

  // Auto-hide control strip after 4 seconds of inactivity
  const showControlStrip = useCallback(() => {
    setControlStripVisible(true);
    if (controlStripTimerRef.current !== null) {
      window.clearTimeout(controlStripTimerRef.current);
    }
    controlStripTimerRef.current = window.setTimeout(() => {
      setControlStripVisible(false);
    }, 4000);
  }, []);

  // Show control strip on pointer move or keydown
  useEffect(() => {
    showControlStrip();
    const handlePointer = () => showControlStrip();
    window.addEventListener("pointermove", handlePointer);
    window.addEventListener("keydown", handlePointer);
    return () => {
      window.removeEventListener("pointermove", handlePointer);
      window.removeEventListener("keydown", handlePointer);
    };
  }, [showControlStrip]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (controlStripTimerRef.current !== null) {
        window.clearTimeout(controlStripTimerRef.current);
      }
    };
  }, []);

  const toggleLayersPanel = useCallback(() => {
    setLayersPanelCollapsed((prev) => !prev);
  }, []);

  const startEditingText = useCallback((layerId: string) => {
    setEditingTextId(layerId);
  }, []);

  const stopEditingText = useCallback(() => {
    setEditingTextId(null);
  }, []);

  const enterPresentationMode = useCallback(() => {
    setIsPresentationMode(true);
    showControlStrip();
  }, [showControlStrip]);

  const exitPresentationMode = useCallback(() => {
    setIsPresentationMode(false);
    showControlStrip();
  }, [showControlStrip]);

  const togglePresentationMode = useCallback(() => {
    setIsPresentationMode((prev) => !prev);
    showControlStrip();
  }, [showControlStrip]);

  const showConfidencePreview = useCallback(() => {
    setIsConfidencePreviewVisible(true);
    showControlStrip();
  }, [showControlStrip]);

  const hideConfidencePreview = useCallback(() => {
    setIsConfidencePreviewVisible(false);
    showControlStrip();
  }, [showControlStrip]);

  const toggleConfidencePreview = useCallback(() => {
    setIsConfidencePreviewVisible((prev) => !prev);
    showControlStrip();
  }, [showControlStrip]);

  return {
    // Panel state
    panelPosition,
    setPanelPosition,
    isLayersPanelCollapsed,
    setLayersPanelCollapsed,
    toggleLayersPanel,

    // Text editing
    editingTextId,
    startEditingText,
    stopEditingText,

    // Presentation mode
    isPresentationMode,
    enterPresentationMode,
    exitPresentationMode,
    togglePresentationMode,

    // Confidence preview
    isConfidencePreviewVisible,
    showConfidencePreview,
    hideConfidencePreview,
    toggleConfidencePreview,

    // Control strip
    controlStripVisible,
    showControlStrip,
  };
}
