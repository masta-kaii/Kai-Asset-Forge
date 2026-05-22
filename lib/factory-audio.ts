/**
 * Factory Audio System — Retro synth sounds using Web Audio API
 * No audio files needed! Generates chiptune-style SFX programmatically.
 */

let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume()
  }
  return audioCtx
}

/** Play a simple retro beep */
function beep(
  frequency: number,
  duration: number,
  type: OscillatorType = "square",
  volume: number = 0.08
) {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)

    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Audio not available
  }
}

/** Retro "power up" ascending arpeggio — pipeline starts */
export function playPipelineStart() {
  beep(440, 0.1, "square", 0.06)
  setTimeout(() => beep(554, 0.1, "square", 0.06), 80)
  setTimeout(() => beep(659, 0.1, "square", 0.06), 160)
  setTimeout(() => beep(880, 0.2, "square", 0.08), 240)
}

/** Happy chime — pipeline step complete */
export function playStepComplete() {
  beep(880, 0.08, "triangle", 0.06)
  setTimeout(() => beep(1109, 0.08, "triangle", 0.06), 60)
  setTimeout(() => beep(1319, 0.15, "triangle", 0.08), 120)
}

/** Fanfare — full pipeline cycle complete */
export function playCycleComplete() {
  const notes = [523, 659, 784, 1047]
  notes.forEach((freq, i) => {
    setTimeout(() => beep(freq, 0.15, "square", 0.07), i * 100)
  })
  setTimeout(() => {
    beep(1319, 0.3, "square", 0.09)
    beep(1047, 0.3, "triangle", 0.05)
  }, notes.length * 100)
}

/** Soft click — agent interaction */
export function playAgentClick() {
  beep(600, 0.06, "triangle", 0.04)
  setTimeout(() => beep(800, 0.04, "triangle", 0.03), 30)
}

/** Error buzz — when something goes wrong */
export function playErrorBuzz() {
  beep(150, 0.15, "sawtooth", 0.08)
  setTimeout(() => beep(120, 0.2, "sawtooth", 0.06), 150)
}

/** Ambient factory tick — subtle floor noise every few seconds */
export function playAmbientTick() {
  beep(100, 0.03, "sine", 0.015)
}

/** Log notification sound */
export function playLogNotification() {
  beep(440, 0.05, "triangle", 0.04)
  setTimeout(() => beep(660, 0.05, "triangle", 0.04), 50)
  setTimeout(() => beep(880, 0.1, "triangle", 0.06), 100)
}

/** Factory ambient drone (call once, it loops infinitely) */
let ambientInterval: ReturnType<typeof setInterval> | null = null

export function startAmbientDrone() {
  if (ambientInterval) return
  // Play a very quiet low drone
  const playDrone = () => {
    beep(55, 1.5, "sine", 0.02)     // Low rumbling
    beep(220, 1.0, "triangle", 0.01)  // Soft harmonic
  }
  playDrone()
  ambientInterval = setInterval(playDrone, 2000)
}

export function stopAmbientDrone() {
  if (ambientInterval) {
    clearInterval(ambientInterval)
    ambientInterval = null
  }
}

/** Initialize the audio system (must be called on user interaction first) */
export function initAudio(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = getAudioCtx()
      if (ctx.state === "running") {
        resolve()
        return
      }
      // Resume on first interaction
      const handler = () => {
        ctx.resume().then(() => {
          document.removeEventListener("click", handler)
          document.removeEventListener("keydown", handler)
          resolve()
        })
      }
      document.addEventListener("click", handler)
      document.addEventListener("keydown", handler)
    } catch {
      resolve()
    }
  })
}
