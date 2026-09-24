// DEV-ONLY benchmark artifact — H bundle entry (runtime only). NOT part of the `streetui` runtime.
import { createApp, h } from 'vue';

createApp({ setup: () => () => h('div', null, 'x') }).mount(document.getElementById('app'));
