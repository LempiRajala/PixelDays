/*
 * get ThreePIDs
 */
import {
  getTPIDsOfUser, removeTpidFromUser,
} from '../../../data/sql/ThreePID.js';
import { comparePasswordToHash } from '../../../utils/hash.js';
import { USERLVL, THREEPID_PROVIDERS } from '../../../core/constants.ts';
import { setUserLvl } from '../../../data/sql/User.js';
import socketEvents from '../../../socket/socketEvents.js';

export default async (req, res) => {
  const { user, body: { id, password }, ttag: { t } } = req;

  const currentPassword = user.data.password;
  if (currentPassword) {
    const err = comparePasswordToHash(password, currentPassword, t);
    if (err !== null) {
      throw err;
    }
  }

  let tpids = await getTPIDsOfUser(req.user.id);
  if (!tpids.some(({ id: tid }) => tid === id)) {
    throw new Error(t`Could not find this login method`);
  }
  tpids = tpids.filter(({ id: tid }) => tid !== id);

  if (!currentPassword && !(tpids.length
    && tpids.some(({ provider }) => provider !== THREEPID_PROVIDERS.EMAIL)
  )) {
    throw new Error(
      // eslint-disable-next-line max-len
      t`You can not delete this login method, because you have nothing else left.`,
    );
  }

  const { userlvl } = user;
  const hasVerified = tpids.some(({ verified }) => verified);
  /* make sure userlvl matches tpids */
  if (!hasVerified && userlvl <= USERLVL.VERIFIED
    && userlvl > USERLVL.REGISTERED
  ) {
    await setUserLvl(user.id, USERLVL.REGISTERED);
    socketEvents.reloadUser(user.id);
  } else if (hasVerified && userlvl === USERLVL.REGISTERED) {
    await setUserLvl(user.id, USERLVL.VERIFIED);
    socketEvents.reloadUser(user.id);
  }

  await removeTpidFromUser(user.id, id);

  res.status(200).json({ success: true });
};
