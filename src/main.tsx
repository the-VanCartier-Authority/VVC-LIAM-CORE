import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './services/serviceWorkerLifecycle';

void registerServiceWorker();

createRoot(document.getElementById('root')!).render(<App />);
