/**
 * Device Configuration
 * Dynamic device selection - devices are now managed via useDevices hook
 * 
 * For backwards compatibility, we export a helper to get the selected device ID
 * Legacy: The hardcoded laptopDeviceId is kept for development/testing only
 */

// Legacy hardcoded device ID - for development/testing only
export const laptopDeviceId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// Get dynamically selected device ID from localStorage
export const getSelectedDeviceId = (): string | null => {
  return localStorage.getItem('aiguard_selected_device_id');
};

// Get the active device ID - prefers selected device, falls back to legacy
export const getActiveDeviceId = (): string => {
  return getSelectedDeviceId() || laptopDeviceId;
};
