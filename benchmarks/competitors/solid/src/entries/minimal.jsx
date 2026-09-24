// DEV-ONLY benchmark artifact — H bundle entry (minimal app). NOT part of the `streetui` runtime.
import { render } from 'solid-js/web';
import { FlatList } from '../app.jsx';

render(() => <FlatList n={1} />, document.getElementById('app'));
