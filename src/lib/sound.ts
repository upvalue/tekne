/**
 * Generates a retro video game "level complete" chiptune sound
 * using the Web Audio API. No external files required.
 */
export function playTimerCompleteSound() {
  try {
    const ctx = new AudioContext()
    const now = ctx.currentTime

    // A rising arpeggio of square-wave notes (classic 8-bit style)
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
    const noteDuration = 0.12
    const gap = 0.02

    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'square'
      osc.frequency.value = notes[i]

      const start = now + i * (noteDuration + gap)
      gain.gain.setValueAtTime(0.15, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(start)
      osc.stop(start + noteDuration)
    }

    // Close the context after the sound finishes
    const totalDuration = notes.length * (noteDuration + gap)
    setTimeout(() => ctx.close(), totalDuration * 1000 + 100)
  } catch {
    // Audio not available - silently ignore
  }
}
