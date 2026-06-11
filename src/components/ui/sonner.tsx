import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      duration={2500}
      gap={10}
      offset={20}
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-2xl !border !backdrop-blur-xl !bg-background/70 !text-foreground !border-border/40 !shadow-[0_8px_32px_-8px_hsl(var(--foreground)/0.18)] !px-4 !py-3 !text-[13px]",
          title: "!font-semibold !tracking-tight",
          description: "!text-muted-foreground !text-[12px] !mt-0.5",
          actionButton: "!bg-primary !text-primary-foreground !rounded-lg",
          cancelButton: "!bg-muted !text-muted-foreground !rounded-lg",
          success: "!border-[hsl(var(--status-success)/0.25)]",
          error: "!border-destructive/30",
          warning: "!border-[hsl(var(--status-warning)/0.3)]",
          info: "!border-primary/25",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
