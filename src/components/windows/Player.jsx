import React, { useContext } from 'react';
import { t } from 'ttag';

import WindowContext from '../context/window.ts';
import EMBEDS from '../embeds/index.js';
import { getLinkDesc } from '../../core/utils.js';

const Player = () => {
  const { args: { uri } } = useContext(WindowContext);

  const desc = getLinkDesc(uri);

  const embedObj = EMBEDS[desc];
  if (!embedObj?.[1](uri)) {
    return <p>{t`This URL is not supported by our Media Player`}</p>;
  }
  const Embed = embedObj[0];

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      backgroundColor: '#270f0f',
      overflow: 'auto',
    }}
    >
      <Embed url={uri} fill />
    </div>
  );
};

export default React.memo(Player);
