import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "../../lib/utils";

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;
const AlertDialogClose = AlertDialogPrimitive.Close;

const AlertDialogOverlay = AlertDialogPrimitive.Overlay;
const AlertDialogContent = AlertDialogPrimitive.Content;
const AlertDialogTitle = AlertDialogPrimitive.Title;
const AlertDialogDescription = AlertDialogPrimitive.Description;

const Overlay = ({ className, ...props }: AlertDialogPrimitive.AlertDialogOverlayProps) => (
  <AlertDialogOverlay
    className={cn("fixed inset-0 z-50 bg-black/70 backdrop-blur-sm", className)}
    {...props}
  />
);

const Content = ({ className, ...props }: AlertDialogPrimitive.AlertDialogContentProps) => (
  <AlertDialogPortal>
    <Overlay />
    <AlertDialogContent
      className={cn(
        "fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-popover p-6 shadow-lg focus:outline-none",
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
);

const Title = ({ className, ...props }: AlertDialogPrimitive.AlertDialogTitleProps) => (
  <AlertDialogTitle className={cn("text-lg font-semibold", className)} {...props} />
);

const Description = ({ className, ...props }: AlertDialogPrimitive.AlertDialogDescriptionProps) => (
  <AlertDialogDescription className={cn("text-sm text-muted-foreground", className)} {...props} />
);

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogClose,
  Overlay as AlertDialogOverlay,
  Content as AlertDialogContent,
  Title as AlertDialogTitle,
  Description as AlertDialogDescription,
};
