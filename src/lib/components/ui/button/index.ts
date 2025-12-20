import Root from "./button.svelte";
import { tv, type VariantProps } from "tailwind-variants";

export const buttonVariants = tv({
  base: "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
      destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
      outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
      gold: "bg-gold text-white shadow hover:bg-gold-dark",
      "gold-outline": "border border-gold text-gold hover:bg-gold/10 hover:border-gold-dark transition-colors",
      "gold-outline-dark": "border-2 border-gold text-white hover:bg-gold hover:border-gold-dark transition-colors",
      white: "bg-white text-foreground shadow hover:bg-white/90 transition-colors",
    },
    size: {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-md px-8",
      icon: "h-9 w-9",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export type Variant = VariantProps<typeof buttonVariants>["variant"];
export type Size = VariantProps<typeof buttonVariants>["size"];

export {
  Root,
  Root as Button,
};
