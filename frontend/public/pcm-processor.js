class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.targetSampleRate = 24000
    this.emptyInputBlocks = 0
    this.port.postMessage({ type: 'ready', sampleRate })
  }

  process(inputs) {
    const input = inputs[0]?.[0]
    if (!input) {
      this.emptyInputBlocks += 1
      if (this.emptyInputBlocks === 1 || this.emptyInputBlocks % 100 === 0) {
        this.port.postMessage({ type: 'no-input', blocks: this.emptyInputBlocks })
      }
      return true
    }

    const outputLength = Math.max(
      1,
      Math.round(input.length * this.targetSampleRate / sampleRate),
    )
    const pcm = new Int16Array(outputLength)
    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * (input.length - 1) / Math.max(1, outputLength - 1)
      const lower = Math.floor(sourceIndex)
      const upper = Math.min(input.length - 1, lower + 1)
      const fraction = sourceIndex - lower
      const sample = input[lower] + (input[upper] - input[lower]) * fraction
      pcm[i] = Math.max(-32768, Math.min(32767, sample * 32768))
    }
    this.port.postMessage(
      { type: 'pcm', buffer: pcm.buffer },
      [pcm.buffer],
    )
    return true
  }
}
registerProcessor('pcm-processor', PcmProcessor)
