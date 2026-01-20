/*
 * Modtools
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

import Canvastools from './ModCanvastools.jsx';
import Admintools from './Admintools.jsx';
import Watchtools from './ModWatchtools.jsx';
import IIDTools from './ModIIDtools.jsx';
import { USERLVL } from '../core/constants.ts';


const CONTENT = {
  Canvas: Canvastools,
  Admin: Admintools,
  Watch: Watchtools,
  IID: IIDTools,
};

function Modtools() {
  const [selectedPart, selectPart] = useState('Canvas');

  const userlvl = useSelector((state) => state.user.userlvl);

  const Content = CONTENT[selectedPart];

  const parts = Object.keys(CONTENT)
    .filter((part) => {
      switch (part) {
        case 'Admin':
          return userlvl >= USERLVL.ADMIN;
        case 'Watch':
        case 'IID':
          return userlvl >= USERLVL.MOD;
        default:
          return true;
      }
    });

  useEffect(() => {
    if (!parts.includes(selectedPart)) {
      selectPart(parts[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userlvl, selectedPart]);

  return (
    <>
      {(parts.length > 1) && (
        <div
          key="tabm"
          className="content"
          style={{ overflowWrap: 'anywhere' }}
        >
          {parts.map((part, ind) => (
            <React.Fragment key={part}>
              <span
                role="button"
                tabIndex={-1}
                className={
                  (selectedPart === part) ? 'modallink selected' : 'modallink'
                }
                onClick={() => selectPart(part)}
              >{part}</span>
              {(ind !== parts.length - 1)
                && <span className="hdivider" />}
            </React.Fragment>
          ))}
          <div className="modaldivider" />
        </div>
      )}
      {Content && <Content />}
    </>
  );
}

export default React.memo(Modtools);
