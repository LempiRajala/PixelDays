import React from 'react';
import { MdPerson } from 'react-icons/md';
import { t } from 'ttag';
import useLink from '../hooks/link.js';
import { useUnreadReports } from '../context/unread-reports.tsx';

const LogInButton = () => {
  const link = useLink();
  const { openReportsNumber } = useUnreadReports();

  return (
    <div
      id="loginbutton"
      className="actionbuttons"
      onClick={() => link('USERAREA', { target: 'parent' })}
      role="button"
      title={t`User Area`}
      tabIndex={-1}
      style={{ position: 'relative' }}
    >
      <MdPerson />
      { openReportsNumber > 0 &&
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          transform: 'translate(50%,-50%)',
          width: '16px',
          height: '16px',
          borderRadius: '9999px',
          background: 'var(--warning-color)',
          border: '1px solid black',
          lineHeight: '16px',
          fontFamily: 'monospace',
          fontSize: '10px',
        }}>
          {
            openReportsNumber > 10
            ? `9+`
            : openReportsNumber
          }
        </div>
      }
    </div>
  );
};

export default React.memo(LogInButton);
