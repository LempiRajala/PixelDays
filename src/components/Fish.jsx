/*
 * Fish that appears randomly on screen and when catched (clicked) grants a
 * temporary cooldown reduction
 */
import { t } from 'ttag';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';

import socketClient from '../socket/SocketClient.js';
import { FISH_TYPES } from '../core/constants.ts';
import { cdn } from '../utils/utag.js';

/* eslint-disable max-len */

const Fish = () => {
  const [submitting, setSubmitting] = useState(false);
  const fish = useSelector((state) => state.user.fish);

  const {
    type, screenPosX, screenPosY, screenSize, screenRotation,
  } = fish;

  return (
    /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */
    <img
      style={{
        position: 'absolute',
        top: `${screenPosY}%`,
        left: `${screenPosX}%`,
        width: `${screenSize}%`,
        '--current-angle': `${screenRotation}deg`,
        transform: 'rotate(var(--current-angle))',
        animation: 'sway 3s ease-in-out infinite',
        filter: 'drop-shadow(5px 5px 10px rgba(0, 0, 0, 0.5))',
        cursor: 'pointer',
        zIndex: 9,
      }}
      src={cdn`/phishes/${FISH_TYPES[type].name.toLowerCase().split(' ').join('')}.webp`}
      alt={t`A Phish!`}
      onClick={() => {
        if (submitting) return;
        setSubmitting(true);
        socketClient.sendCatchFish();
      }}
    />
  );
};

export default Fish;
