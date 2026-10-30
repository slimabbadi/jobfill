import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/public-sans';
import '@/ui/base.css';
import './popup.css';
import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';

createRoot(document.getElementById('root')!).render(<Popup />);
