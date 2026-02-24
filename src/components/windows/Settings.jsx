/**
 *
 */

import React from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { c, t } from 'ttag';

import SettingsItem from '../SettingsItem.tsx';
import SettingsItemSelect from '../SettingsItemSelect.jsx';
import LanguageSelect from '../LanguageSelect.tsx';
import TemplateSettings from '../TemplateSettings.jsx';
import {
  toggleGrid,
  togglePixelNotify,
  toggleMvmCtrls,
  toggleMute,
  toggleAutoZoomIn,
  toggleCompactPalette,
  toggleChatNotify,
  toggleCursor,
  togglePotatoMode,
  toggleLightGrid,
  toggleHistoricalView,
  selectPencilMode,
  selectStyle,
} from '../../store/actions/index.js';

const Settings = () => {
  const [
    isGridShown,
    isPixelNotifyShown,
    isMvmCtrlsShown,
    autoZoomIn,
    compactPalette,
    isPotato,
    isLightGrid,
    selectedStyle,
    isMuted,
    chatNotify,
    cursor,
    pencilMode,
    isHistoricalView,
    canvasName,
    templatesAvailable,
  ] = useSelector((state) => [
    state.gui.showGrid,
    state.gui.showPixelNotify,
    state.gui.showMvmCtrls,
    state.gui.autoZoomIn,
    state.gui.compactPalette,
    state.gui.isPotato,
    state.gui.isLightGrid,
    state.gui.style,
    state.gui.mute,
    state.gui.chatNotify,
    state.gui.cursor,
    state.canvas.pencilMode,
    state.canvas.isHistoricalView,
    state.canvas.canvases[state.canvas.canvasId]?.title,
    state.templates.available,
  ], shallowEqual);
  const dispatch = useDispatch();
  const audioAvailable = window.AudioContext || window.webkitAudioContext;
  // order according to PENCIL_MODE constant
  const pencilModesAvailable = [t`Selected Color`, t`From Template`];
  if (window.ssv?.backupurl) pencilModesAvailable.push(t`From History`);

  return (
    <div className="content">
      <SettingsItem
        title={t`Show Grid`}
        keyBind={c('keybinds').t`G`}
        value={isGridShown}
        onToggle={() => dispatch(toggleGrid())}
      >
        {t`Turn on grid to highlight pixel borders.`}
      </SettingsItem>
      <SettingsItem
        title={t`Show Pixel Activity`}
        keyBind={c('keybinds').t`X`}
        value={isPixelNotifyShown}
        onToggle={() => dispatch(togglePixelNotify())}
      >
        {t`Show circles where pixels are placed.`}
      </SettingsItem>
      <SettingsItem
        title={t`Always show Movement Controls`}
        keyBind={c('keybinds').t`N`}
        value={isMvmCtrlsShown}
        onToggle={() => dispatch(toggleMvmCtrls())}
      >
        {t`Always show movement control buttons`}
      </SettingsItem>
      <SettingsItem
        title={t`Disable Game Sounds`}
        keyBind={c('keybinds').t`M`}
        deactivated={(!audioAvailable)}
        value={!audioAvailable || isMuted}
        onToggle={() => dispatch(toggleMute())}
      >
        {[t`All sound effects will be disabled.`,
          (!audioAvailable) && (
            <p className="warn">
              {/* eslint-disable-next-line max-len */}
              {t`Your Browser doesn't allow us to use AudioContext to play sounds. Do you have some privacy feature blocking us?`}
            </p>
          ),
        ]}
      </SettingsItem>
      <SettingsItem
        title={t`Enable chat notifications`}
        value={chatNotify}
        onToggle={() => dispatch(toggleChatNotify())}
      >
        {t`Play a sound when new chat messages arrive`}
      </SettingsItem>
      <SettingsItem
        title={t`Auto Zoom In`}
        value={autoZoomIn}
        onToggle={() => dispatch(toggleAutoZoomIn())}
      >
        {/* eslint-disable-next-line max-len */}
        {t`Zoom in instead of placing a pixel when you tap the canvas and your zoom is small.`}
      </SettingsItem>
      <SettingsItem
        title={t`Compact Palette`}
        // eslint-disable-next-line max-len
        value={compactPalette}
        onToggle={() => dispatch(toggleCompactPalette())}
      >
        {t`Display Palette in a compact form that takes less screen space.`}
      </SettingsItem>
      <SettingsItem
        title={t`Potato Mode`}
        value={isPotato}
        onToggle={() => dispatch(togglePotatoMode())}
      >
        {t`For when you are playing on a potato.`}
      </SettingsItem>
      <SettingsItem
        title={t`Light Grid`}
        value={isLightGrid}
        onToggle={() => dispatch(toggleLightGrid())}
      >
        {t`Show Grid in white instead of black.`}
      </SettingsItem>
      <SettingsItem
        title={t`Custom Cursor`}
        value={cursor}
        onToggle={() => dispatch(toggleCursor())}
      >
        {t`Use our custom cursor`}
      </SettingsItem>
      {(window.ssv?.backupurl) && (
        <SettingsItem
          title={t`Historical View`}
          value={isHistoricalView}
          keyBind={c('keybinds').t`H`}
          onToggle={() => dispatch(toggleHistoricalView())}
        >
          {t`Check out past versions of the canvas.`}
        </SettingsItem>
      )}
      <SettingsItemSelect
        title={t`Pencil Mode for ${canvasName} canvas`}
        values={pencilModesAvailable}
        selected={pencilModesAvailable[pencilMode]}
        keyBind={c('keybinds').t`B`}
        onSelect={
          (i) => dispatch(selectPencilMode(pencilModesAvailable.indexOf(i)))
        }
      >
        {t`What the pencil should draw on the current canvas.`}
      </SettingsItemSelect>
      {(window.ssv?.availableStyles) && (
        <SettingsItemSelect
          title={t`Themes`}
          values={Object.keys(window.ssv.availableStyles)}
          selected={selectedStyle}
          onSelect={(style) => dispatch(selectStyle(style))}
        >
          {t`How pixeldays should look like.`}
        </SettingsItemSelect>
      )}
      {(window.ssv?.langs && navigator.cookieEnabled) && (
        <div className="setitem">
          <div className="setrow">
            <h3 className="settitle">
              {t`Select Language`}
            </h3>
            <LanguageSelect />
          </div>
        </div>
      )}
      <div className="modaldivider" />
      {(templatesAvailable) && <TemplateSettings />}
    </div>
  );
};

export default React.memo(Settings);
