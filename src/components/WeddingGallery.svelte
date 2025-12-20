<script lang="ts">
  import PhotoSwipeLightbox from './PhotoSwipeLightbox.svelte';

  interface Props {
    images: Array<{ src: string; alt: string }>;
  }

  let { images }: Props = $props();

  let lightboxOpen = $state(false);
  let selectedIndex = $state(0);

  function openLightbox(index: number) {
    selectedIndex = index;
    lightboxOpen = true;
  }
</script>

<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
  {#each images as image, index}
    <button
      type="button"
      class="gallery-item overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer block w-full p-0 border-0 bg-transparent group"
      onclick={() => openLightbox(index)}
      aria-label="View {image.alt} in lightbox"
    >
      <img
        src={image.src}
        alt={image.alt}
        width="400"
        height="256"
        class="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105 bg-neutral-200"
        loading="lazy"
        onerror={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          img.onerror = null;
          img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%23e5e5e5' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23737373' font-family='system-ui' font-size='14'%3EImage unavailable%3C/text%3E%3C/svg%3E";
        }}
      />
    </button>
  {/each}
</div>

<PhotoSwipeLightbox
  {images}
  initialIndex={selectedIndex}
  bind:open={lightboxOpen}
/>

<style>
  .gallery-item:focus-visible {
    outline: 2px solid #D4AF37;
    outline-offset: 2px;
  }
</style>
