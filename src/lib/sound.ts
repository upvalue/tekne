/**
 * Synthesized 16-bit style success jingle using the Web Audio API.
 * Inspired by classic SNES/Genesis victory sounds.
 *
 * No external audio files required - entirely procedurally generated.
 */
export function playTimerCompleteSound() {
  try {
    const ctx = new AudioContext()
    const now = ctx.currentTime

    const master = ctx.createGain()
    master.gain.value = 0.18
    master.connect(ctx.destination)

    // Two-part success jingle: quick rising phrase + held major chord
    // Phase 1: Fast ascending notes (16-bit triangle wave style)
    const phrase: [number, number, number][] = [
      // [frequency, startTime, duration]
      [523.25, 0, 0.08],     // C5
      [587.33, 0.08, 0.08],  // D5
      [659.25, 0.16, 0.08],  // E5
      [783.99, 0.24, 0.08],  // G5
    ]

    for (const [freq, start, dur] of phrase) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.8, now + start)
      gain.gain.exponentialRampToValueAtTime(0.01, now + start + dur)
      osc.connect(gain)
      gain.connect(master)
      osc.start(now + start)
      osc.stop(now + start + dur + 0.01)
    }

    // Phase 2: Held major chord (C major, octave 5) with slow fade
    const chordStart = 0.34
    const chordDur = 0.45
    const chordNotes = [523.25, 659.25, 783.99] // C5, E5, G5

    for (const freq of chordNotes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.6, now + chordStart)
      gain.gain.exponentialRampToValueAtTime(0.001, now + chordStart + chordDur)
      osc.connect(gain)
      gain.connect(master)
      osc.start(now + chordStart)
      osc.stop(now + chordStart + chordDur + 0.01)
    }

    // Add a higher octave shimmer on the chord for brightness
    const shimmer = ctx.createOscillator()
    const shimmerGain = ctx.createGain()
    shimmer.type = 'sine'
    shimmer.frequency.value = 1046.5 // C6
    shimmerGain.gain.setValueAtTime(0.25, now + chordStart)
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + chordStart + chordDur)
    shimmer.connect(shimmerGain)
    shimmerGain.connect(master)
    shimmer.start(now + chordStart)
    shimmer.stop(now + chordStart + chordDur + 0.01)

    setTimeout(() => ctx.close(), (chordStart + chordDur) * 1000 + 200)
  } catch {
    // Audio not available - silently ignore
  }
}
