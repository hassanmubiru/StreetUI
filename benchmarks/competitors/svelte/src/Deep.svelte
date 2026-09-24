<!-- DEV-ONLY benchmark artifact — Svelte 5 deep reactive state (E). NOT part of the `streetui` runtime. -->
<script>
  import { store } from './store.svelte.js';
</script>

<section class="main">
  <div class="leaf">{store.user.profile.name}</div>
  <div class="leaf">{store.user.preferences.theme}</div>
  <div class="leaf">{String(store.user.permissions.admin)}</div>
  <div class="leaf" id="activity">seen:{store.user.activity.lastSeen}</div>
</section>
