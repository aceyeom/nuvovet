import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Self-hosted fonts — no third-party font CDN at runtime.
// Pretendard (Korean + Latin UI), Geist Mono (clinical numbers / codes).
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@fontsource-variable/geist-mono/wght.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
