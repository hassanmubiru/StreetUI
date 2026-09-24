<!-- DEV-ONLY benchmark artifact — Svelte 5 one-bound cell in many (B). NOT part of the `streetui` runtime. -->
<script>
  import { store } from './store.svelte.js';
  let { n } = $props();
</script>

<section class="main">
  {#each Array.from({ length: n }, (_, i) => i) as i (i)}
    <div class="row">static {i}</div>
  {/each}
  <div class="live" id="live">{store.live}</div>
</section>
