// DEV-ONLY benchmark artifact — H bundle entry (full app). NOT part of the `streetui` runtime.
// References every workload component so the built bundle reflects the full
// benchmark app surface (see scenario H).
import { createRoot } from 'react-dom/client';
import { FlatList, OneBound, FanOut, KeyedList, DeepState } from '../app.jsx';

const bridge = {};
const components = [FlatList, OneBound, FanOut, KeyedList, DeepState];
const root = createRoot(document.getElementById('app'));
root.render(<FlatList n={1} />);
// keep the other components reachable so tree-shaking retains them
globalThis.__components = components.length + Object.keys(bridge).length;
