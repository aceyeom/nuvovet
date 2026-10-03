import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Self-hosted fonts — no third-party font CDN at runtime.
// Pretendard (Korean + Latin UI), Instrument Serif (English accent),
// Geist Mono (clinical numbers / codes).
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource-variable/geist-mono/wght.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
