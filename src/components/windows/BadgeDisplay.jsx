/*
 * window to display a badge
 */
import React, { useContext, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import WindowContext from '../context/window.js';
import { setBrightness, colorFromText } from '../../core/utils.js';
import { cdn } from '../../utils/utag.js';
import { requestBadge } from '../../store/actions/fetch.js';
import { selectIsDarkMode } from '../../store/selectors/gui.ts';
import ClipboardCopyField from '../ClipboardCopyField.jsx';
import { buildPopUpUrl } from './popUpAvailable.js';

const BadgeDisplay = () => {
  const [errors, setErrors] = useState([]);
  const [badge, setBadge] = useState(null);

  const isDarkMode = useSelector(selectIsDarkMode);
  const { args: { id } } = useContext(WindowContext);

  useEffect(() => {
    (async () => {
      const badgeData = await requestBadge(id);
      if (badgeData.errors) {
        setErrors(badgeData.errors);
        return;
      }
      setBadge(badgeData);
    })();
  }, [id]);

  if (!badge) {
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

  const { name, note, description, ts, userName, userDisplayName } = badge;
  const shortname = name.toLowerCase().split(' ').join('');

  return (
    <div className="content">
      <h3>{name}</h3>
      <img
        className="display-img"
        src={cdn`/badges/${shortname}.webp`}
        alt={name}
      />
      <p>{description}</p>
      {typeof note === 'string' && <p key="nt">{note}</p>}
      <p>
        <span className="stattext">{t`Date of Award`}:</span>&nbsp;
        <span className="statvalue">{new Date(ts).toLocaleString()}</span>
      </p>
      <p>
        <span className="stattext">{t`For`}:</span>&nbsp;
        <span
          className="statvalue"
          style={{
            color: setBrightness(colorFromText(userName), isDarkMode),
          }}
        >{` ${userName} `}</span>[{` ${userDisplayName} `}]
      </p>
      <p>
        {t`Copy URL`}:&nbsp;
        <ClipboardCopyField
          hideField="true"
          text={window.location.origin + buildPopUpUrl('BADGE_DISPLAY', { id })}
        />
      </p>
    </div>
  );
};

export default BadgeDisplay;
