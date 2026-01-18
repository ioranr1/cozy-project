import { ReactNode } from 'react';
import { useCapabilities, CapabilityKey, Capabilities } from '@/hooks/useCapabilities';
import { DesktopAppRequiredCard } from '@/components/DesktopAppRequiredCard';

interface FeatureGateProps {
  /** Array of capability keys that must all be true */
  requires: CapabilityKey[];
  /** 
   * "hide" = render nothing if requirements not met
   * "lock" = render locked card if requirements not met
   */
  mode?: 'hide' | 'lock';
  /** Title for the lock card (when mode="lock") */
  title?: string;
  /** Description for the lock card (when mode="lock") */
  description?: string;
  /** CTA button text (optional) */
  ctaText?: string;
  /** CTA button action (optional) */
  ctaAction?: () => void;
  /** Content to render when all requirements are met */
  children: ReactNode;
  /** Additional className for the lock card */
  className?: string;
}

/**
 * Conditionally renders children based on platform capabilities.
 * 
 * @example
 * // Hide feature if not on Electron
 * <FeatureGate requires={['isElectron']} mode="hide">
 *   <CameraControls />
 * </FeatureGate>
 * 
 * @example
 * // Show locked card with download CTA
 * <FeatureGate 
 *   requires={['canBackgroundRun', 'canRecordSegments']} 
 *   mode="lock"
 *   title="Recording Requires Desktop App"
 *   description="Download our desktop app to enable local recording."
 *   ctaText="Download App"
 *   ctaAction={() => window.open('/download')}
 * >
 *   <RecordingPanel />
 * </FeatureGate>
 */
export function FeatureGate({
  requires,
  mode = 'lock',
  title,
  description,
  ctaText,
  ctaAction,
  children,
  className,
}: FeatureGateProps) {
  const capabilities = useCapabilities();

  // Check if all required capabilities are met
  const allRequirementsMet = requires.every((key) => {
    const value = capabilities[key as keyof Capabilities];
    return value === true;
  });

  // If all requirements met, render children
  if (allRequirementsMet) {
    return <>{children}</>;
  }

  // Requirements not met
  if (mode === 'hide') {
    return null;
  }

  // mode === 'lock' - show the locked card
  return (
    <DesktopAppRequiredCard
      title={title}
      description={description}
      ctaText={ctaText}
      ctaAction={ctaAction}
      className={className}
    />
  );
}

/**
 * Hook to check capabilities directly without rendering a gate.
 * Re-exports useCapabilities for convenience.
 */
export { useCapabilities } from '@/hooks/useCapabilities';
export type { Capabilities, CapabilityKey } from '@/hooks/useCapabilities';
