/*
 * Menu with Buttons on the top left
 *
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

import HelpButton from './buttons/HelpButton.jsx';
import SettingsButton from './buttons/SettingsButton.jsx';
import LogInButton from './buttons/LogInButton.jsx';
import DownloadButton from './buttons/DownloadButton.jsx';

const Menu = () => {
  const [render, setRender] = useState(false);
  const menuOpen = useSelector((state) => state.gui.menuOpen);

  useEffect(() => {
    if (menuOpen) {
      setTimeout(() => setRender(true), 10);
    }
  }, [menuOpen]);

  const onTransitionEnd = () => {
    if (!menuOpen) setRender(false);
  };

  return (
    (render || menuOpen) && (
      <div
        className={(menuOpen && render) ? 'menu show' : 'menu'}
        onTransitionEnd={onTransitionEnd}
      >
        <SettingsButton />
        <LogInButton />
        <DownloadButton />
        <HelpButton />
      </div>
    )
  );
};

export default React.memo(Menu);
