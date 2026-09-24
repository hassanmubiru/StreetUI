<!-- DEV-ONLY benchmark artifact — Svelte 5 flat list (A/F/G). NOT part of the `streetui` runtime. -->
<script>
  let { n } = $props();
</script>

<section class="main">
  {#each Array.from({ length: n }, (_, i) => i) as i (i)}
    <div class="row">node {i}</div>
  {/each}
</section>
