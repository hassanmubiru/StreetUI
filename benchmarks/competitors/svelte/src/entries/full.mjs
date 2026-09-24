// DEV-ONLY benchmark artifact — H bundle entry (full app). NOT part of the `streetui` runtime.
import { mount } from 'svelte';
import Flat from '../Flat.svelte';
import OneBound from '../OneBound.svelte';
import FanOut from '../FanOut.svelte';
import List from '../List.svelte';
import Deep from '../Deep.svelte';

const components = [Flat, OneBound, FanOut, List, Deep];
mount(Flat, { target: document.getElementById('app'), props: { n: 1 } });
globalThis.__components = components.length;
