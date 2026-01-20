/*
 * map flags of user
 */
import { USERLVL } from '../core/constants.ts';

export default function mapFlag(uid, userlvl, country) {
  if (userlvl >= USERLVL.CLEANER) {
    switch (userlvl) {
      case USERLVL.CLEANER:
        return 'z3';
      case USERLVL.JANNY:
        return 'z2';
      case USERLVL.MOD:
        return 'z1';
      default:
        return 'zz';
    }
  } else if (uid === 2927) {
    /*
     * hard coded flags
     * TODO make it possible to modify user flags
     */
    return 'bt';
  } else if (uid === 41030) {
    return 'to';
  } else if (uid === 1384) {
    return 'fa';
  } else if (uid === 351896) {
    return 'c1';
  } else if (uid === 1) {
    return 'zz';
  }
  return country;
}
