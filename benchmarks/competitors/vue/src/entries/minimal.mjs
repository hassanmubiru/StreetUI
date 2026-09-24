// DEV-ONLY benchmark artifact — H bundle entry (minimal app). NOT part of the `streetui` runtime.
import { createApp } from 'vue';
import { makeFlat } from '../app.mjs';

createApp(makeFlat(1).App).mount(document.getElementById('app'));
