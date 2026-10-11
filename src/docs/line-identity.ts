/** 128 random bits, encoded without padding: 24 characters including l_. */
export const lineIdMake = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return `l_${btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')}`
}

export const LINE_ID_PATTERN = /^l_[A-Za-z0-9_-]{21}[AQgw]$/
