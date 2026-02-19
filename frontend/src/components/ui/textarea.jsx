import { cn } from "../../lib/utils"

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "resize-none transition-colors",
        className
      )}
      {...props}
    />
  )
}
