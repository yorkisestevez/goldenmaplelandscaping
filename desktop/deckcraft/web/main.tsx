// The DeckCraft page on its own, for the desktop app: no site chrome, consent banner, analytics tags or prerender.
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {HelmetProvider} from 'react-helmet-async';
import {BrowserRouter} from 'react-router-dom';
import DeckDesigner from '../../../src/pages/DeckDesigner';
import './desktop.css';

declare global{interface Window{deckcraftDesktop?:{readonly platform:string;readonly shell:string;ready?:()=>void}}}

createRoot(document.getElementById('root')!).render(<StrictMode><HelmetProvider><BrowserRouter><DeckDesigner/></BrowserRouter></HelmetProvider></StrictMode>);
// Two frames after the first render the designer has painted; the shell opens its window then, not on a blank frame.
requestAnimationFrame(()=>requestAnimationFrame(()=>window.deckcraftDesktop?.ready?.()));
