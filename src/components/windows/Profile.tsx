import React, { useEffect, useState } from 'react';
import { t } from 'ttag';

import { useWindow } from '../context/window.ts';
import { getUserInfo, UserInfoResponse } from '../../api/user-info.ts';
import { UserProfileInfo } from '../user-profile-info.tsx';

const Profile = () => {
  const { args: { userId } } = useWindow();
  const [userInfo, setUserInfo] = useState<UserInfoResponse | null>(null);

  useEffect(() => {
    if(userId === undefined || userId === null) return;

    const controller = new AbortController();
    getUserInfo(userId, controller)
      .then(setUserInfo)
      .catch(e => console.error(e));
    
    return () => controller.abort();
  }, [userId]);

  return (
    <div style={{
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

// function LoadedProfile({
//   username,
//   createdAt,
//   lastSeen,
//   avatarId,
//   bannerId,
// }: UserInfoResponse) {
//   const header = <h2>{username}</h2>;
//   const description = (
//     <div style={{
//       display: 'flex',
//       flexDirection: 'column',
//       justifyContent: 'center',
//       gap: '4px',
//     }}>
//       <div style={{ whiteSpace: 'nowrap' }}>{t`Registered`}: {formatDate(createdAt)}</div>
//       <div style={{ whiteSpace: 'nowrap' }}>{t`Last login`}: {formatDate(lastSeen)}</div>
//     </div>
//   )

//   if(!avatarId && !bannerId) {
//     return (
//       <>
//         {header}
//         {description}
//       </>
//     )
//   }

//   if(avatarId && !bannerId) {
//     return (
//       <>
//         {header}
//         <div style={{
//           display: 'flex',
//           flexDirection: 'row',
//           gap: '8px',
//         }}>
//           <img
//             alt='user avatar'
//             src={getFileUrl(avatarId)}
//             style={{
//               width: '128px',
//               height: '128px',
//               borderRadius: '9999px',
//               boxShadow: '0 0 5px black',
//             }}
//           />
//           {description}
//         </div>
//       </>
//     )
//   }

//   // баннер есть, аватарка опционально
//   return (
//     <>
//       {header}
//       <div style={{
//         position: 'relative',
//         marginBottom: '8px',
//       }}>
//         <img
//           alt='user banner'
//           src={getFileUrl(bannerId!)}
//           style={{
//             maxWidth: '100%',
//             maxHeight: '400px',
//           }}
//         />
//         { avatarId !== null &&
//           <img
//             alt='user avatar'
//             src={getFileUrl(avatarId)}
//             style={{
//               width: '128px',
//               height: '128px',
//               position: 'absolute',
//               left: '0',
//               bottom: '0',
//             }}
//           />
//         }
//       </div>
//       {description}
//     </>
//   )
// }

// function formatDate(date: Date) {
//   const iso = date.toISOString();
//   return iso.substring(0, iso.indexOf('.')).replaceAll('-', '.').replaceAll('T', ' ');
// }