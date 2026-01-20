/*
 * List of caught fishes inside profile
 */
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import useLink from './hooks/link.js';
import { setBrightness, colorFromText } from '../core/utils.js';
import { FISH_TYPES } from '../core/constants.ts';
import { cdn } from '../utils/utag.js';

const FishList = () => {
  const [expanded, setExpanded] = useState(false);
  const fishes = useSelector((state) => state.profile.fishes);
  const link = useLink();
  if (!fishes.length) {
    return null;
  }
  const sliceTill = (expanded) ? fishes.length : 4;

  return (
    <p className="fishlist">
      <span className="stattext">{t`Phishes`}:</span>
      {fishes.slice(0, sliceTill).map(({ type, size, ts, id }) => {
        const { name } = FISH_TYPES[type];
        const shortname = name.toLowerCase().split(' ').join('');
        const backgroundColor = setBrightness(colorFromText(shortname), false);
        return (
          <span
            key={ts}
            style={{
              backgroundColor,
            }}
            className="profilefish"
            title={name}
            onClick={(evt) => {
              evt.stopPropagation();
              link('FISH_DISPLAY', {
                reuse: true,
                target: 'blank',
                args: { id },
                title: name,
                width: 385,
                height: 522,
              });
            }}
          >
            <img
              className={`profilefish-img ${shortname}`}
              src={cdn`/phishes/thumb/${shortname}.webp`}
              alt={name}
            />
            <span
              style={{ color: `hsl(${Math.floor(size / 25 * 120)}, 70%, 75%)` }}
            ><span className="profilefish-size">{size}</span>&nbsp;kg</span>
          </span>
        );
      })}
      {(fishes.length > 4) && (
        <span
          key="expand"
          className="profilefish expandbtn"
          title={(expanded) ? t`Retract` : t`Expand`}
          onClick={(evt) => {
            evt.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          <span>{(expanded) ? '◄' : '►'}</span>
        </span>
      )}
    </p>
  );
};

export default React.memo(FishList);
