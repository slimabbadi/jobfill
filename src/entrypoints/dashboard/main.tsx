import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/public-sans';
import '@/ui/base.css';
import './dashboard.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
