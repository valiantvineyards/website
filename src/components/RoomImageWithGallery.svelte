<script lang="ts">
  import PhotoSwipeLightbox from './PhotoSwipeLightbox.svelte';

  export let heroSrc: string;
  export let heroAlt: string;
  export let images: { src: string; alt: string }[] = [];
  export let roomName: string = '';

  let isOpen = false;
  let selectedIndex = 0;

  function openGallery(index: number = 0) {
    selectedIndex = index;
    isOpen = true;
  }
</script>

<!-- Clickable Hero Image -->
<button
  on:click={() => openGallery(0)}
  class="block w-full h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 overflow-hidden transform-none!"
  aria-label="View all photos of {roomName}"
>
  <div class="aspect-4/3 relative group">
    <img
      src={heroSrc}
      alt={heroAlt}
      width="400"
      height="300"
      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 bg-neutral-200"
      on:error={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        img.onerror = null;
        img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%23e5e5e5' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23737373' font-family='system-ui' font-size='14'%3EImage unavailable%3C/text%3E%3C/svg%3E";
      }}
    />
    <!-- Hover overlay (desktop) -->
    <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
      <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-charcoal" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
        </svg>
      </div>
    </div>
    <!-- Photo count badge (always visible, especially useful on mobile) -->
    <div class="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/60 text-white text-sm font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      {images.length}
    </div>
  </div>
</button>

<PhotoSwipeLightbox
  {images}
  initialIndex={selectedIndex}
  bind:open={isOpen}
/>
