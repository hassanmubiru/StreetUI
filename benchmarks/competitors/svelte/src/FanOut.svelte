<!-- DEV-ONLY benchmark artifact — Svelte 5 reactive fan-out (D). NOT part of the `streetui` runtime. -->
<script>
  import { store } from './store.svelte.js';
  let { n } = $props();
</script>

<section class="main">
  {#each Array.from({ length: n }, (_, i) => i) as i (i)}
    <div class="sub">{store.val}</div>
  {/each}
</section>
