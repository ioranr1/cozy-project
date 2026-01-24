/**
 * Away Mode Renderer Script
 * =========================
 * 
 * Add this script to your index.html for Away mode UI interactions.
 * 
 * IMPORTANT: This file does NOT touch any video/WebRTC logic.
 * It only handles Away mode UI notifications and prompts.
 */

// ============================================================
// AWAY MODE UI HANDLERS
// ============================================================

(function initAwayModeRenderer() {
  'use strict';
  
  // Check if Away mode API is available
  const api = window.electronAPI || window.awayModeAPI;
  
  if (!api) {
    console.log('[AwayModeRenderer] No API available, skipping initialization');
    return;
  }
  
  console.log('[AwayModeRenderer] Initializing Away mode renderer...');
  
  // ============================================================
  // NOTIFICATION HELPERS
  // ============================================================
  
  /**
   * Show a toast-style notification
   */
  function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'away-mode-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      ${type === 'error' 
        ? 'background: rgba(239, 68, 68, 0.9); color: white; border: 1px solid rgba(239, 68, 68, 0.5);'
        : type === 'success'
        ? 'background: rgba(34, 197, 94, 0.9); color: white; border: 1px solid rgba(34, 197, 94, 0.5);'
        : 'background: rgba(251, 191, 36, 0.9); color: #1e293b; border: 1px solid rgba(251, 191, 36, 0.5);'
      }
    `;
    notification.textContent = message;
    
    // Add animation keyframes if not already present
    if (!document.getElementById('away-mode-styles')) {
      const style = document.createElement('style');
      style.id = 'away-mode-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Remove after 4 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }
  
  /**
   * Show user-returned modal prompt
   */
  function showUserReturnedPrompt(strings) {
    // Remove existing prompt if any
    const existing = document.getElementById('away-mode-prompt');
    if (existing) existing.remove();
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'away-mode-prompt';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      animation: fadeIn 0.2s ease-out;
    `;
    
    const isRTL = document.documentElement.dir === 'rtl';
    
    modal.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border: 1px solid rgba(251, 191, 36, 0.3);
        border-radius: 20px;
        padding: 32px;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        direction: ${isRTL ? 'rtl' : 'ltr'};
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">👋</div>
        <h2 style="
          color: #fbbf24;
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 12px;
        ">${strings.userReturnedTitle}</h2>
        <p style="
          color: #94a3b8;
          font-size: 15px;
          margin-bottom: 24px;
          line-height: 1.5;
        ">${strings.userReturnedMessage}</p>
        <div style="display: flex; gap: 12px; ${isRTL ? 'flex-direction: row-reverse;' : ''}">
          <button id="away-mode-disable-btn" style="
            flex: 1;
            padding: 14px 20px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            border: none;
            color: white;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          ">${strings.disableAwayMode}</button>
          <button id="away-mode-keep-btn" style="
            flex: 1;
            padding: 14px 20px;
            background: rgba(71, 85, 105, 0.5);
            border: 1px solid rgba(71, 85, 105, 0.5);
            color: #94a3b8;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          ">${strings.keepAwayMode}</button>
        </div>
      </div>
    `;
    
    // Add fadeIn animation
    if (!document.getElementById('away-mode-modal-styles')) {
      const style = document.createElement('style');
      style.id = 'away-mode-modal-styles';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(modal);
    
    // Button handlers
    document.getElementById('away-mode-disable-btn').addEventListener('click', () => {
      modal.remove();
      if (api.awayModeDisableConfirmed) {
        api.awayModeDisableConfirmed();
      }
    });
    
    document.getElementById('away-mode-keep-btn').addEventListener('click', () => {
      modal.remove();
      if (api.awayModeKeep) {
        api.awayModeKeep();
      }
    });
    
    // Add hover effects
    const disableBtn = document.getElementById('away-mode-disable-btn');
    const keepBtn = document.getElementById('away-mode-keep-btn');
    
    disableBtn.addEventListener('mouseenter', () => {
      disableBtn.style.transform = 'translateY(-2px)';
      disableBtn.style.boxShadow = '0 10px 20px rgba(245, 158, 11, 0.3)';
    });
    disableBtn.addEventListener('mouseleave', () => {
      disableBtn.style.transform = '';
      disableBtn.style.boxShadow = '';
    });
    
    keepBtn.addEventListener('mouseenter', () => {
      keepBtn.style.background = 'rgba(71, 85, 105, 0.7)';
      keepBtn.style.color = '#e2e8f0';
    });
    keepBtn.addEventListener('mouseleave', () => {
      keepBtn.style.background = 'rgba(71, 85, 105, 0.5)';
      keepBtn.style.color = '#94a3b8';
    });
  }
  
  // ============================================================
  // EVENT LISTENERS
  // ============================================================
  
  // Away mode enabled notification
  if (api.onAwayModeEnabled) {
    api.onAwayModeEnabled((data) => {
      console.log('[AwayModeRenderer] Away mode enabled:', data.message);
      showNotification(data.message, 'success');
    });
  }
  
  // Away mode disabled notification
  if (api.onAwayModeDisabled) {
    api.onAwayModeDisabled((data) => {
      console.log('[AwayModeRenderer] Away mode disabled:', data.message);
      showNotification(data.message, 'info');
    });
  }
  
  // Preflight failure notification
  if (api.onAwayModePreflightFailed) {
    api.onAwayModePreflightFailed((data) => {
      console.log('[AwayModeRenderer] Preflight failed:', data.errors);
      const message = `${data.title}\n${data.errors.join('\n')}`;
      showNotification(message, 'error');
    });
  }
  
  // User returned prompt
  if (api.onAwayModeUserReturned) {
    api.onAwayModeUserReturned((data) => {
      console.log('[AwayModeRenderer] User returned, showing prompt');
      showUserReturnedPrompt(data.strings);
    });
  }
  
  // Camera availability check
  if (api.onAwayModeCheckCamera) {
    api.onAwayModeCheckCamera(async () => {
      console.log('[AwayModeRenderer] Checking camera availability...');
      
      try {
        // Get list of video devices without starting capture
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        const hasCamera = videoDevices.length > 0;
        console.log('[AwayModeRenderer] Camera check result:', hasCamera, videoDevices.length, 'devices');
        
        if (api.awayModeCameraCheckResult) {
          api.awayModeCameraCheckResult({
            success: hasCamera,
            message: hasCamera ? undefined : 'No camera devices found',
          });
        }
      } catch (err) {
        console.error('[AwayModeRenderer] Camera check error:', err);
        if (api.awayModeCameraCheckResult) {
          api.awayModeCameraCheckResult({
            success: false,
            message: err.message,
          });
        }
      }
    });
  }
  
  console.log('[AwayModeRenderer] Initialization complete');
})();
