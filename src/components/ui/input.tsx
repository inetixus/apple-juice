import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#8a8f98] focus:outline-none focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] transition-all disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
