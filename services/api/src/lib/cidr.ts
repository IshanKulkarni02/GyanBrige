// Lightweight IPv4 CIDR check. No deps, handles "10.0.0.0/16"-style strings.

function ipToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let acc = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    acc = (acc << 8) | n;
  }
  return acc >>> 0;
}

export function isIpInCidr(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split('/');
  if (!base || !bits) return false;
  const ipInt = ipToInt(ip);
  const baseInt = ipToInt(base);
  if (ipInt === null || baseInt === null) return false;
  const n = Number(bits);
  if (n === 0) return true;
  if (n < 1 || n > 32) return false;
  const mask = n === 32 ? 0xffffffff : (~((1 << (32 - n)) - 1)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}
