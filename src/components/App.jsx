/**
 * Main App
 */

import React, { useEffect, useRef } from 'react';
import { Provider } from 'react-redux';
import { createRoot } from 'react-dom/client';
import { IconContext } from 'react-icons';

import Style from './Style.jsx';
import CoordinatesBox from './CoordinatesBox.jsx';
import CanvasSwitchButton from './buttons/CanvasSwitchButton.jsx';
import OnlineBox from './OnlineBox.jsx';
import ChatButton from './buttons/ChatButton.jsx';
import Menu from './Menu.jsx';
import UI from './UI.jsx';
import ExpandMenuButton from './buttons/ExpandMenuButton.jsx';
import WindowManager from './WindowManager.jsx';
import useLink from './hooks/link.js';
import BrushButton from './buttons/BrushButton.jsx';
import { UnreadReportsProvider } from './context/unread-reports.tsx';
import { runMalwareProtection } from '../core/malware-protection.js';
import { addLocale, useLocale } from 'ttag';
import { decompressFromBase64 } from 'lz-string';
import { pAlert } from '../store/actions/index.js';
import store from '../store/store.ts';

const iconContextValue = { style: { verticalAlign: 'middle' } };

const App = () => (
  <>
    <Style />
    <IconContext.Provider value={iconContextValue}>
      <CanvasSwitchButton />
      <Menu />
      <ChatButton />
      <BrushButton />
      <OnlineBox />
      <CoordinatesBox />
      <ExpandMenuButton />
      <UI />
      <WindowManager />
      <OnStartup />
    </IconContext.Provider>
  </>
);

function OnStartup() {
  const link = useLink();
  const malwareProtectionInited = useRef(false);

  useEffect(() => {
    if(!localStorage.getItem('startup_window_showed')) {
      localStorage.setItem('startup_window_showed', 'true');
      link('HELP', { target: 'parent' });
    }

    if(!malwareProtectionInited.current) {
      malwareProtectionInited.current = true;
      runMalwareProtection();
    }

    window.test = () => {
      store.dispatch(pAlert({
        title: `Not allowed`,
        message: `You are using a Proxy.`,
        alertType: 'error',
        retcode: 11,
      }));
    }
  }, []);

  return null;
}

function renderApp(domParent, store) {
  const root = createRoot(domParent);

  if('_LANG_CODE' in window && window._LANG_CODE !== 'en') {
    addLocale(_LANG_CODE, JSON.parse(decompressFromBase64(_LANG_TRANSLATION)));
    useLocale(_LANG_CODE);
  }
  
  root.render(
    <Provider store={store}>
      <UnreadReportsProvider>
        <App />
      </UnreadReportsProvider>
    </Provider>,
  );
}

export default renderApp;
