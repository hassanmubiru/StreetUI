// DEV-ONLY benchmark artifact — H bundle entry (runtime only). NOT part of the `streetui` runtime.
import { mount } from 'svelte';
import Hello from '../Hello.svelte';

mount(Hello, { target: document.getElementById('app') });
