import React, { useEffect, useRef, useState } from 'react';
import { t } from 'ttag';

import { useWindow } from '../context/window.ts';
import { getUserInfo, UserInfoResponse } from '../../api/user-info.ts';
import { UserProfileInfo } from '../user-profile-info.tsx';

const Profile = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const { args: { userId } } = useWindow();
  const [userInfo, setUserInfo] = useState<UserInfoResponse | null>(null);

  useEffect(() => {
    if(!rootRef.current) return;
    rootRef.current.parentElement!.parentElement!.click();
  }, []);

  useEffect(() => {
    if(userId === undefined || userId === null) return;

    const controller = new AbortController();
    getUserInfo(userId, controller)
      .then(setUserInfo)
      .catch(e => console.error(e));
    
    return () => controller.abort();
  }, [userId]);

  return (
    <div ref={rootRef} style={{
      width: '100%',
      height: '100%',
      padding: '8px',
      boxSizing: 'border-box',
    }}>
      { userInfo === null &&
        <p>Loading...</p>
      }
      { userInfo !== null &&
        <UserProfileInfo {...userInfo}/>
      }
    </div>
  );
};

export default React.memo(Profile);