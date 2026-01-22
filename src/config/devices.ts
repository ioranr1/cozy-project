/**
 * Device Configuration
 * Dynamic device selection - devices are now managed via useDevices hook
 */

// Get dynamically selected device ID from localStorage
export const getSelectedDeviceId = (): string | null => {
  return localStorage.getItem('aiguard_selected_device_id');
};

// Get the active device ID - returns null if none selected (no legacy fallback)
export const getActiveDeviceId = (): string | null => {
  return getSelectedDeviceId();
};
