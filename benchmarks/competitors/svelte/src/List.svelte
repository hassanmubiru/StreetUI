<!-- DEV-ONLY benchmark artifact — Svelte 5 keyed list (C). NOT part of the `streetui` runtime. -->
<script>
  import { store } from './store.svelte.js';
</script>

<section class="main">
  {#each store.items as it (it.id)}
    <div class="cell">{it.label}</div>
  {/each}
</section>
