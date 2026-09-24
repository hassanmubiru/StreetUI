// DEV-ONLY benchmark artifact — H bundle entry (minimal app). NOT part of the `streetui` runtime.
import { createRoot } from 'react-dom/client';
import { FlatList } from '../app.jsx';

createRoot(document.getElementById('app')).render(<FlatList n={1} />);
