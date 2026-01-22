/**
 * Main App
 */

import React, { useEffect } from 'react';
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

  useEffect(() => {
    if(localStorage.getItem('startup_window_showed')) return;
    localStorage.setItem('startup_window_showed', 'true');

    link('HELP', { target: 'parent' });
  }, []);

  return null;
}

function renderApp(domParent, store) {
  const root = createRoot(domParent);
  root.render(
    <Provider store={store}>
      <App />
    </Provider>,
  );
}

export default renderApp;
