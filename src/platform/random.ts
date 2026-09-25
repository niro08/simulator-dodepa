/** Случайный seed для нового забега (единственный источник «настоящей» случайности). */
export function randomSeed(): number {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    return cryptoApi.getRandomValues(new Uint32Array(1))[0] ?? 0
  }
  return (Date.now() ^ (performance.now() * 1000)) >>> 0
}
