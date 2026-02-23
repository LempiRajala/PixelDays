/**
 *
 * basic functions for parsing IPs
 */

/**
 * Get hostname from request
 * @param req express req object
 * @param includeProto if we include protocol (https, http)
 * @param stripSub if we strip subdomains
 * @return host (like pixeldays.xyz)
 */
export function getHostFromRequest(req, includeProto = true, stripSub = false) {
  const { headers } = req;
  let host = headers['x-forwarded-host']
    || headers[':authority']
    || headers.host;
  if (stripSub) {
    const firstDot = host.indexOf('.');
    const lastDot = host.lastIndexOf('.');
    if (firstDot !== lastDot) {
      /* assume that more than two dots is an IPv4 */
      if (host.indexOf('.', firstDot + 1) === lastDot) {
        host = host.slice(host.indexOf('.'));
      }
    } else {
      host = `.${host}`;
    }
  }
  if (!includeProto) {
    return host;
  }
  const proto = headers['x-forwarded-proto'] || 'http';
  return `${proto}://${host}`;
}

/**
 * Check if IP is v6 or v4
 * @param ip ip as string
 * @return true if ipv6, false otherwise
 */
export function isIPv6(ip) {
  return ip.includes(':');
}

/**
 * unpack IPv6 address into 8 blocks
 * @param ip IPv6 IP string
 * @return Array with length 8 of IPv6 parts as strings
 */
export function unpackIPv6(ip) {
  let ipUnpack = ip.split(':');
  const spacer = ipUnpack.indexOf('');
  if (spacer !== -1) {
    ipUnpack = ipUnpack.filter((a) => a);
    ipUnpack.splice(spacer, 0, ...Array(8 - ipUnpack.length).fill('0'));
  }
  return ipUnpack;
}

/**
 * Get hex representation of IP
 * @param ip ip as string (if IPv6, the first 64bit have to be unpacked)
 * @return hex string (without leading '0x')
 */
export function ipToHex(ip) {
  if (isIPv6(ip)) {
    return ip.split(':')
      .slice(0, 4)
      .map((n) => `000${n}`.slice(-4).toLowerCase())
      .join('');
  }
  return ip.split('.')
    .map((n) => `0${parseInt(n, 10).toString(16)}`.slice(-2))
    .join('');
}

/**
 * Sanitize IP in string form
 * @param ipString ip as string
 * @return sanitized ip as string
 */
export function sanitizeIPString(ipString) {
  if (isIPv6(ipString)) {
    ipString = `${unpackIPv6(ipString).slice(0, 4).join(':')}::`;
  }
  return ipString;
}

/**
 * Parse IPv4 string to Number and IPv6 string to BigInt of first 64bit
 * @param ipString ip string
 * @return numerical IP (Number or BigInt)
 */
function ipToNum(ipString) {
  if (!ipString) {
    return null;
  }
  if (isIPv6(ipString)) {
    // IPv6
    const hex = unpackIPv6(ipString.trim())
      .map((n) => `000${n}`.slice(-4))
      .slice(0, 4).join('');
    try {
      return BigInt(`0x${hex}`);
    } catch {
      return null;
    }
  }
  // IPv4
  const ipArr = ipString
    .split('.')
    .map((numString) => parseInt(numString, 10));
  if (ipArr.length !== 4 || ipArr.some((num) => Number.isNaN(num))) {
    return null;
  }
  // >>>0 is needed to convert from signed to unsigned
  return ((ipArr[0] << 24)
    + (ipArr[1] << 16)
    + (ipArr[2] << 8)
    + ipArr[3]) >>> 0;
}

/**
 * parse num representation of IP to hex
 * @param num IP as 64bit BigInt if IPv6, Number if IPv4
 * @return hex
 */
function numToHex(num) {
  const ip = `00000000${num.toString(16)}`;
  return ip.slice(
    (typeof num === 'bigint') ? -16 : -8,
  );
}

/**
 * parse hex representation of IP to string
 * @param hex IP as 64bit hex for IPv6 and 32bit hex for IPv4
 * @return ip as string
 */
export function hexToIP(hex) {
  let ip = '';
  if (hex.length === 8) {
    // IPv4
    let i = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      ip += parseInt(hex.slice(i, i += 2), 16).toString(10);
      if (i >= 8) break;
      ip += '.';
    }
  } else {
    // IPv6
    for (let i = 0; i < 16; i += 4) {
      const part = hex.slice(i, i + 4);
      if (part === '0000') {
        ip += '0';
      } else {
        ip += part;
      }
      ip += ':';
    }
    ip += ':';
  }
  return ip;
}

/**
 * parse range into readable string
 * @param range [start, end, mask] with start and end in hex
 * @return string
 */
export function rangeToString(range) {
  if (!range) {
    return undefined;
  }
  return `${hexToIP(range[0])}/${range[2]}`;
}

/**
 * Get Array of CIDRs for an 32bit numerical IP range
 * @param [start, end] with numerical IPs as Number
 * @return Array of CIDR strings
 */
function ip32RangeNumToCIDR(start, end, ip) {
  let maskNum = 32;
  let mask = 0xFFFFFFFF;
  const diff = start ^ end;
  while (diff & mask) {
    mask <<= 1;
    maskNum -= 1;
  }
  if ((start & (~mask)) || (~(end | mask))) {
    const divider = (start | (~mask >> 1)) >>> 0;
    if (ip) {
      if (ip <= divider) {
        return ip32RangeNumToCIDR(start, divider, ip);
      }
      return ip32RangeNumToCIDR(divider + 1, end, ip);
    }
    return ip32RangeNumToCIDR(start, divider).concat(
      ip32RangeNumToCIDR(divider + 1, end),
    );
  }
  return [[start, end, maskNum]];
}

/**
 * Get Array of CIDRs for an 64bit numerical IP range
 * @param [start, end] with numerical IPs as BigInt
 * @param ip if given, return only range that includes ip
 * @return Array of CIDR strings
 */
function ip64RangeNumToCIDR(start, end, ip) {
  let maskNum = 64;
  const mask64 = 0xFFFFFFFFFFFFFFFFn;
  let mask = mask64;
  const diff = start ^ end;
  while (diff & mask) {
    mask = (mask << 1n) & mask64;
    maskNum -= 1;
  }
  const invMask = ~mask & mask64;
  if ((start & invMask) || (~(end | mask) & mask64)) {
    const divider = start | (invMask >> 1n);
    if (ip) {
      if (ip <= divider) {
        return ip64RangeNumToCIDR(start, divider, ip);
      }
      return ip64RangeNumToCIDR(divider + 1n, end, ip);
    }
    return ip64RangeNumToCIDR(start, divider).concat(
      ip64RangeNumToCIDR(divider + 1n, end),
    );
  }
  return [[start, end, maskNum]];
}

/**
 * Parse subnet given as string into array numerical representations
 * @param subnet given as CIDR or range
 * @param ip if given, return only range that includes ip
 * @return [start, end, mask] start and end as hex and mask part of CIDR
 *          Array of same if ip isn't given and there could be multiple
 */
export function ipSubnetToHex(subnet, ip) {
  const ipNum = ip && ipToNum(ip);
  if (!subnet || (ip && ipNum === null)) {
    return null;
  }
  let ranges;
  if (subnet.includes('-')) {
    // given as range
    const [start, end] = subnet.split('-').map(ipToNum);
    if (start === null
      || typeof start !== typeof end
      || start > end
      || (ipNum && typeof ipNum !== typeof start)
    ) {
      return null;
    }
    const numRanges = (typeof start === 'bigint')
      ? ip64RangeNumToCIDR(start, end, ipNum)
      : ip32RangeNumToCIDR(start, end, ipNum);
    ranges = numRanges;
  } else {
    // given as CIDR
    let [start, mask] = subnet.split('/');
    start = ipToNum(start);
    mask = parseInt(mask, 10);
    if (start === null || !mask) {
      return null;
    }
    let end;
    if (typeof start === 'bigint') {
      // IPv6
      if (mask >= 64) {
        end = start;
      } else {
        const bitmask = (0xFFFFFFFFFFFFFFFFn >> BigInt(mask));
        start &= (~bitmask & 0xFFFFFFFFFFFFFFFFn);
        end = start | bitmask;
      }
    } else if (mask === 32) {
      // IPv4
      end = start;
    } else {
      const bitmask = (0xFFFFFFFF >>> mask);
      start = (start & ~bitmask) >>> 0;
      end = (start | bitmask) >>> 0;
    }
    ranges = [[start, end, mask]];
  }
  if (ipNum && (ipNum < ranges[0][0] || ipNum > ranges[0][1])) {
    return null;
  }
  ranges = ranges.map(([s, e, m]) => [numToHex(s), numToHex(e), m]);
  if (ip) {
    [ranges] = ranges;
  }
  return ranges;
}

/**
 * Get a tiny subnet that includes ip, this is used as stand-in, to
 * store a placeholder range, for ips that we do not know nothing about
 * @param ip as tring
 * @return [start, end, mask] start and end as hex and mask part of CIDR
 *          Array of same if ip isn't given and there could be multiple
 */
export function getLowHexSubnetOfIP(ip) {
  let start = ipToNum(ip);
  if (start === null) {
    return null;
  }
  let mask;
  let end;
  if (typeof start === 'bigint') {
    // IPv6
    mask = 56;
    const bitmask = (0xFFFFFFFFFFFFFFFFn >> BigInt(mask));
    start &= (~bitmask & 0xFFFFFFFFFFFFFFFFn);
    end = start | bitmask;
  } else {
    mask = 24;
    const bitmask = (0xFFFFFFFF >>> mask);
    start = (start & ~bitmask) >>> 0;
    end = (start | bitmask) >>> 0;
  }
  return [numToHex(start), numToHex(end), mask];
}
