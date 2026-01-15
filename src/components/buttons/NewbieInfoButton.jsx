/**
 *
 */

import React from 'react';
import { FaQuestion } from 'react-icons/fa';
import { t } from 'ttag';

import useLink from '../hooks/link.js';

const NewbieInfoButton = () => {
  const link = useLink();

  return (
    <div
      id="newbieinfobutton"
      className="actionbuttons"
      onClick={() => link('NEWBIE_INFO', { target: 'parent' })}
      role="button"
      title={t`Newbie info`}
      tabIndex={-1}
    >
      <FaQuestion />
    </div>
  );
};

export default React.memo(NewbieInfoButton);
