import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

// Capsule dimensions: w-11 = 44px, h-6 = 24px
// Thumb dimensions: h-5 w-5 = 20px
// Inner padding: (24px - 20px) / 2 = 2px
// Translate distance: 44px - 20px - 2px - 2px = 20px (translate-x-5)

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent overflow-hidden transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-0px)] data-[state=unchecked]:translate-x-0",
        // Calculated: capsule inner width (44px - 4px border) = 40px, thumb = 20px
        // Max translate = 40px - 20px = 20px = translate-x-5
      )}
      style={{
        // Dynamic calculation: move thumb by (capsuleWidth - thumbWidth - padding)
        // Using CSS custom properties for precise positioning
        '--switch-translate': 'calc(var(--radix-switch-width, 44px) - 100% - 4px)',
      } as React.CSSProperties}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
