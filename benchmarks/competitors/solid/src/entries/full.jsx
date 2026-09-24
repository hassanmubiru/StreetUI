// DEV-ONLY benchmark artifact — H bundle entry (full app). NOT part of the `streetui` runtime.
import { render } from 'solid-js/web';
import { FlatList, OneBound, FanOut, KeyedList, DeepState } from '../app.jsx';

const components = [FlatList, OneBound, FanOut, KeyedList, DeepState];
render(() => <FlatList n={1} />, document.getElementById('app'));
globalThis.__components = components.length;
