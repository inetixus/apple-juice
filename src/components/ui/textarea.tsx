import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full bg-transparent border border-white/10 rounded-lg px-3 py-3 text-sm text-white placeholder:text-[#8a8f98] focus:outline-none focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] transition-all resize-y disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
