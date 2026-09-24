// DEV-ONLY benchmark artifact — H bundle entry (full app). NOT part of the `streetui` runtime.
import { createApp } from 'vue';
import { makeFlat, makeOneBound, makeFanOut, makeList, makeDeep } from '../app.mjs';

const factories = [makeFlat, makeOneBound, makeFanOut, makeList, makeDeep];
createApp(makeFlat(1).App).mount(document.getElementById('app'));
globalThis.__factories = factories.length;
