/* The little club bird. Separate joints let the body, wings and feet act. */
export function clubBird() {
  return `<svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="92" cy="162" rx="42" ry="7" fill="#153c32" opacity=".13"/>
    <g stroke="#23473a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
      <g class="bird-feet" fill="none" stroke="#bf713c"><path d="M76 143v17m0-2-11 5m11-5 8 4M108 143v17m0-2-9 5m9-5 10 3"/></g>
      <g class="bird-body">
        <path d="M51 107Q14 98 22 76Q45 79 60 98" fill="#438471"/>
        <path d="M59 74Q40 93 48 124Q54 150 91 152Q135 153 141 114Q147 78 122 59" fill="#5d9c7b"/>
        <ellipse cx="97" cy="117" rx="34" ry="31" fill="#edb26b" stroke="none"/>
        <path class="bird-wing" d="M63 91Q39 95 51 119Q61 131 81 121Q62 112 63 91Z" fill="#337b64"/>
        <g class="bird-head">
          <path d="M59 71Q50 40 69 26Q81 17 105 25Q138 28 140 62Q145 87 122 99Q97 108 76 94Q60 86 59 71Z" fill="#fff0cc"/>
          <path d="M71 30Q59 15 70 10Q76 10 86 25Q89 10 99 15L102 26" fill="#5d9c7b"/>
          <path d="M128 65L151 76L130 84Z" fill="#e59c42"/>
          <ellipse cx="110" cy="58" rx="7" ry="10" fill="#23473a" stroke="none"/>
          <circle cx="112" cy="55" r="2.4" fill="white" stroke="none"/>
          <path d="M102 42q8-6 15 0" fill="none" stroke-width="3"/>
          <ellipse cx="120" cy="79" rx="9" ry="6" fill="#edb09a" stroke="none"/>
          <path d="M95 83q7 7 14 2" fill="none" stroke-width="2.5"/>
        </g>
      </g>
    </g>
  </svg>`;
}

let audioContext;
export function playFinishSound(enabled, birdie) {
  if (!enabled) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume().catch(() => {});
    const now = audioContext.currentTime;
    const notes = [[.85, 260, .12], [1.25, 659, .18], [1.43, 830, .18], [1.65, birdie ? 1108 : 988, .4]];
    const voices = [];
    for (const [delay, hz, length] of notes) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(.09, now + delay + .012);
      gain.gain.exponentialRampToValueAtTime(.001, now + delay + length);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      voices.push({ oscillator, gain });
      oscillator.start(now + delay); oscillator.stop(now + delay + length);
    }
    return () => voices.forEach(({ oscillator, gain }) => {
      gain.gain.cancelScheduledValues(audioContext.currentTime);
      gain.gain.setValueAtTime(0, audioContext.currentTime);
      try { oscillator.stop(); } catch {}
    });
  } catch { /* Sound is optional, including on browsers without Web Audio. */ }
}
