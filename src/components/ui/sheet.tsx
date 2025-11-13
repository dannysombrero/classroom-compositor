import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "../../lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

const SheetPortal = ({ className, ...props }: SheetPrimitive.DialogPortalProps) => (
  <SheetPrimitive.Portal className={cn(className)} {...props} />
);
SheetPortal.displayName = SheetPrimitive.Portal.displayName;

const SheetOverlay = ({ className, ...props }: SheetPrimitive.DialogOverlayProps) => (
  <SheetPrimitive.Overlay
    className={cn("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm", className)}
    {...props}
  />
);
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>
>(({ className, side = "right", children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 gap-4 bg-popover p-6 shadow-lg transition ease-in-out",
        side === "right" && "inset-y-0 right-0 h-full w-80 border-l border-border",
        side === "left" && "inset-y-0 left-0 h-full w-80 border-r border-border",
        side === "top" && "inset-x-0 top-0 w-full border-b border-border",
        side === "bottom" && "inset-x-0 bottom-0 w-full border-t border-border",
        className,
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);

const SheetTitle = ({ className, ...props }: SheetPrimitive.DialogTitleProps) => (
  <SheetPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />
);

const SheetDescription = ({ className, ...props }: SheetPrimitive.DialogDescriptionProps) => (
  <SheetPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
);

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
