<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import PhotoSwipe from 'photoswipe';
  import 'photoswipe/style.css';

  interface Props {
    images: Array<{ src: string; alt: string; width?: number; height?: number }>;
    initialIndex?: number;
    open?: boolean;
    onclose?: () => void;
  }

  let { images, initialIndex = 0, open = $bindable(false), onclose }: Props = $props();

  let pswp: PhotoSwipe | null = null;

  $effect(() => {
    if (open && images.length > 0) {
      openPhotoSwipe();
    }
  });

  function openPhotoSwipe() {
    // Map images to PhotoSwipe format
    const items = images.map((img) => ({
      src: img.src,
      alt: img.alt,
      // PhotoSwipe needs dimensions - use reasonable defaults if not provided
      width: img.width || 1200,
      height: img.height || 800,
    }));

    pswp = new PhotoSwipe({
      dataSource: items,
      index: initialIndex,
      bgOpacity: 0.95,
      showHideAnimationType: 'fade',
      hideAnimationDuration: 200,
      showAnimationDuration: 250,
      pswpModule: PhotoSwipe,
      errorMsg: 'This image could not be loaded',
    });

    pswp.on('close', () => {
      open = false;
      onclose?.();
      pswp = null;
    });

    // Handle image load errors in lightbox
    pswp.on('loadComplete', (e) => {
      const { slide } = e;
      if (slide && slide.data.element) {
        const img = slide.data.element.querySelector('img');
        if (img) {
          const element = slide.data.element;
          img.onerror = () => {
            if (element) {
              element.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#999;font-family:system-ui;">Image unavailable</div>';
            }
          };
        }
      }
    });

    pswp.init();
  }

  onDestroy(() => {
    if (pswp) {
      pswp.close();
      pswp = null;
    }
  });
</script>

<style>
  :global(.pswp__button--arrow) {
    color: white;
  }

  :global(.pswp__button:hover) {
    color: #D4AF37;
  }

  :global(.pswp__counter) {
    color: rgba(255, 255, 255, 0.7);
  }
</style>
