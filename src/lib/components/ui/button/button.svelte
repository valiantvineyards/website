<script lang="ts">
  import { cn } from "$lib/utils/cn";
  import { buttonVariants, type Variant, type Size } from "./index";
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  interface Props extends HTMLButtonAttributes {
    variant?: Variant;
    size?: Size;
    children?: Snippet;
    class?: string;
  }

  let {
    variant = "default",
    size = "default",
    class: className,
    children,
    ...restProps
  }: Props = $props();
</script>

<button class={cn(buttonVariants({ variant, size }), className)} {...restProps}>
  {#if children}
    {@render children()}
  {/if}
</button>
