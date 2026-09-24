// DEV-ONLY benchmark artifact — H bundle entry (minimal app). NOT part of the `streetui` runtime.
import { mount } from 'svelte';
import Flat from '../Flat.svelte';

mount(Flat, { target: document.getElementById('app'), props: { n: 1 } });
