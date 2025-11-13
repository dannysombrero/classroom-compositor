import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "../../lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = ({ className, ...props }: DialogPrimitive.DialogOverlayProps) => (
  <DialogPrimitive.Overlay
    className={cn("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm", className)}
    {...props}
  />
);

const DialogContent = ({ className, ...props }: DialogPrimitive.DialogContentProps) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border border-border bg-popover p-6 shadow-lg focus:outline-none",
        className,
      )}
      {...props}
    />
  </DialogPortal>
);

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);

const DialogTitle = ({ className, ...props }: DialogPrimitive.DialogTitleProps) => (
  <DialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />
);

const DialogDescription = ({ className, ...props }: DialogPrimitive.DialogDescriptionProps) => (
  <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
);

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
