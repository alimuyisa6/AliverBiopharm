import { useState, useEffect, useRef } from "react";

export default function PageProgressBar({ active, progress }) {
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (active) {
      setVisible(true);
      setWidth(progress !== null ? progress : 15);
      if (progress === null) {
        let w = 15;
        timerRef.current = setInterval(() => {
          w = Math.min(w + Math.random() * 12, 85);
          setWidth(w);
        }, 500);
      }
    } else {
      clearInterval(timerRef.current);
      setWidth(100);
      const t = setTimeout(() => { setVisible(false); setWidth(0); }, 500);
      return () => clearTimeout(t);
    }
    return () => clearInterval(timerRef.current);
  }, [active, progress]);

  if (!visible) return null;
  return (
    <div className="alv-progress-bar">
      <div className="alv-progress-bar-fill" style={{ width: `${width}%`, opacity: width >= 100 ? 0 : 1 }} />
    </div>
  );
}
