<script lang="ts">
  import { onMount } from "svelte";

  interface Props {
    text: string;
    link?: string;
    linkText?: string;
  }

  let { text, link, linkText }: Props = $props();

  const STORAGE_KEY = "vv-announcement-dismissed";

  let visible = $state(false);

  function djb2(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  onMount(() => {
    const hash = djb2(text);
    if (localStorage.getItem(STORAGE_KEY) !== hash) {
      visible = true;
    }
  });

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, djb2(text));
    visible = false;
  }
</script>

{#if visible}
  <div role="region" aria-label="Site announcement" class="bg-gold text-white">
    <div class="mx-auto flex max-w-7xl items-center justify-between gap-x-4 px-4 py-2.5 sm:px-6">
      <p class="text-sm font-medium leading-snug">
        {text}
        {#if link}
          <a
            href={link}
            class="ml-2 inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:no-underline"
          >
            {linkText || "Learn more"}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              class="size-4"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M3 10a.75.75 0 0 1 .75-.75h10.638l-3.72-3.72a.75.75 0 1 1 1.06-1.06l5 5a.75.75 0 0 1 0 1.06l-5 5a.75.75 0 1 1-1.06-1.06l3.72-3.72H3.75A.75.75 0 0 1 3 10Z"
                clip-rule="evenodd"
              />
            </svg>
          </a>
        {/if}
      </p>
      <button
        type="button"
        onclick={dismiss}
        class="shrink-0 rounded-md p-1 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-label="Dismiss announcement"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          class="size-5"
          aria-hidden="true"
        >
          <path
            d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
          />
        </svg>
      </button>
    </div>
  </div>
{/if}
