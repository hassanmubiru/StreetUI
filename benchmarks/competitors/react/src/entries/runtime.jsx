// DEV-ONLY benchmark artifact — H bundle entry (runtime only). NOT part of the `streetui` runtime.
// Pulls in the React client runtime with a no-op mount so the built bundle
// reflects framework runtime weight (see scenario H).
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('app')).render(createElement('div', null, 'x'));
