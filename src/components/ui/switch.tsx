import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const INNER_PADDING_PX = 2;

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, style, ...props }, forwardedRef) => {
  const rootRef = React.useRef<React.ElementRef<typeof SwitchPrimitives.Root> | null>(null);
  const thumbRef = React.useRef<React.ElementRef<typeof SwitchPrimitives.Thumb> | null>(null);

  const setRefs = React.useCallback(
    (node: React.ElementRef<typeof SwitchPrimitives.Root> | null) => {
      rootRef.current = node;
      if (!forwardedRef) return;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else (forwardedRef as React.MutableRefObject<typeof node | null>).current = node;
    },
    [forwardedRef],
  );

  React.useLayoutEffect(() => {
    const root = rootRef.current;
    const thumb = thumbRef.current;
    if (!root || !thumb) return;

    const update = () => {
      const capsuleWidth = root.clientWidth;
      const thumbWidth = thumb.clientWidth;
      // translateX = capsuleWidth - thumbWidth - innerPadding (both sides)
      const translateX = Math.max(0, capsuleWidth - thumbWidth - INNER_PADDING_PX * 2);
      root.style.setProperty("--switch-translate-x", `${translateX}px`);
    };

    update();

    // Keep it correct under responsive / font / zoom changes.
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(root);
      ro.observe(thumb);
      return () => ro.disconnect();
    }
  }, []);

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent overflow-hidden transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
      ref={setRefs}
      style={{ ...style } as React.CSSProperties}
    >
      <SwitchPrimitives.Thumb
        ref={thumbRef}
        className={cn(
          // Absolute positioning prevents flex/RTL quirks; overflow-hidden on capsule guarantees no corner bleed.
          "pointer-events-none absolute left-[2px] top-1/2 block h-5 w-5 -translate-y-1/2 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[var(--switch-translate-x)]",
        )}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
