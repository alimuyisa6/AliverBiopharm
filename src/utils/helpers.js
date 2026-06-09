export function esc(t) {
  if (!t) return '';
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function speakText(text, btn) {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  document.querySelectorAll('.audio-btn.playing').forEach((b) => b.classList.remove('playing'));
  if (btn) btn.classList.add('playing');
  const cleanText = text.replace(/<[^>]*>/g, '').trim();
  if (!cleanText) {
    if (btn) btn.classList.remove('playing');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 0.85;
  utterance.pitch = 1.0;
  utterance.volume = 1;
  const setVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (voice) =>
        voice.lang === 'en-US' &&
        (voice.name.includes('Google') ||
          voice.name.includes('Samantha') ||
          voice.name.includes('Female'))
    );
    if (preferredVoice) utterance.voice = preferredVoice;
  };
  if (window.speechSynthesis.getVoices().length > 0) setVoice();
  else window.speechSynthesis.onvoiceschanged = setVoice;
  utterance.onend = function () {
    if (btn) btn.classList.remove('playing');
  };
  utterance.onerror = function () {
    if (btn) btn.classList.remove('playing');
  };
  window.speechSynthesis.speak(utterance);
}
