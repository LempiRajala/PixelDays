/*
 * window to display a fish
 */
import React, { useContext, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import WindowContext from '../context/window.ts';
import { setBrightness, colorFromText } from '../../core/utils.js';
import { FISH_TYPES } from '../../core/constants.ts';
import { cdn } from '../../utils/utag.js';
import { requestFish } from '../../store/actions/fetch.js';
import { selectIsDarkMode } from '../../store/selectors/gui.ts';
import ClipboardCopyField from '../ClipboardCopyField.jsx';
import { buildPopUpUrl } from './popUpAvailable.js';

const FishDisplay = () => {
  const [errors, setErrors] = useState([]);
  const [fish, setFish] = useState(null);

  const isDarkMode = useSelector(selectIsDarkMode);
  const { args: { id } } = useContext(WindowContext);

  useEffect(() => {
    (async () => {
      const fishData = await requestFish(id);
      if (fishData.errors) {
        setErrors(fishData.errors);
        return;
      }
      setFish(fishData);
    })();
  }, [id]);

  if (!fish) {
    return (
      <div className="content">
        {errors.map((error) => (
          <p key={error} className="errormessage">
            <span>{t`Error`}</span>:&nbsp;{error}</p>
        ))}
        {!errors.length && (<p key="l">...</p>)}
      </div>
    );
  }

  const { type, size, ts, caughtByName, caughtByUsername } = fish;
  const { name } = FISH_TYPES[type];
  const shortname = name.toLowerCase().split(' ').join('');
  const backgroundColor = setBrightness(colorFromText(shortname), false);

  return (
    <div className="content">
      <p>
        <span
          className="fishdisplay-title"
          style={{
            backgroundColor,
            color: `hsl(${Math.floor(size / 25 * 120)}, 70%, 75%)`,
          }}
        >{name}</span>
      </p>
      <img
        className="display-img"
        src={cdn`/phishes/${shortname}.webp`}
        alt={name}
      />
      <p>
        <span className="stattext">{t`Size`}:</span>&nbsp;
        <span className="statvalue">{size}</span>&nbsp;
        <span className="stattext">kg</span>
      </p>
      <p>
        <span className="stattext">{t`Date of catch`}:</span>&nbsp;
        <span className="statvalue">{new Date(ts).toLocaleString()}</span>
      </p>
      <p>
        <span className="stattext">{t`Caught by`}:</span>&nbsp;
        <span
          className="statvalue"
          style={{
            color: setBrightness(colorFromText(caughtByName), isDarkMode),
          }}
        >{` ${caughtByName} `}</span>[{` ${caughtByUsername} `}]
      </p>
      <p>
        {t`Copy URL`}:&nbsp;
        <ClipboardCopyField
          hideField="true"
          text={window.location.origin + buildPopUpUrl('FISH_DISPLAY', { id })}
        />
      </p>
    </div>
  );
};

export default FishDisplay;
