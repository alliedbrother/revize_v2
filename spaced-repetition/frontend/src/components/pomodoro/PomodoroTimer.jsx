import { useState, useRef, useEffect } from 'react';
import './Pomodoro.css';

const SESSION_TYPES = [
  { key: 'focus', label: 'Focus', duration: 25 * 60, color: 'var(--gradient-navy)' },
  { key: 'short', label: 'Short Break', duration: 5 * 60, color: '#00bcd4' },
  { key: 'long', label: 'Long Break', duration: 15 * 60, color: '#00d4aa' },
];

const QUOTES = [
  "Stay focused, you're doing great!",
  "Small steps every day!",
  "Breaks help your brain grow.",
  "Deep breaths, deep focus.",
  "You've got this!"
];

function PomodoroTimer() {
  const [sessionIdx, setSessionIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_TYPES[0].duration);
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const intervalRef = useRef(null);

  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get responsive dimensions
  const getCircleDimensions = () => {
    if (windowWidth <= 576) {
      return { size: 200, radius: 80, center: 100 };
    } else if (windowWidth <= 768) {
      return { size: 240, radius: 100, center: 120 };
    } else if (windowWidth <= 1200) {
      return { size: 280, radius: 120, center: 140 };
    }
    return { size: 320, radius: 140, center: 160 };
  };

  const { size, radius, center } = getCircleDimensions();

  // Timer logic
  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          setCompleted(c => c + 1);
          setQuoteIdx(q => (q + 1) % QUOTES.length);
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  // Change session
  const handleSession = idx => {
    setSessionIdx(idx);
    setSecondsLeft(SESSION_TYPES[idx].duration);
    setIsRunning(false);
  };

  // Format time
  const format = s => `${String(Math.floor(s/60)).padStart(2, '0')}:${String(s%60).padStart(2, '0')}`;

  // Progress for circle
  const progress = 1 - secondsLeft / SESSION_TYPES[sessionIdx].duration;

  return (
    <div className="pomodoro-main">
      <div className="pomodoro-card">
        <h3 className="pomodoro-title">Pomodoro Timer</h3>
        <div className="pomodoro-session-tabs">
          {SESSION_TYPES.map((s, i) => (
            <button
              key={s.key}
              className={`pomodoro-tab${i === sessionIdx ? ' active' : ''}`}
              style={i === sessionIdx ? { background: s.color, color: '#fff' } : {}}
              onClick={() => handleSession(i)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className={`pomodoro-timer-visual ${!isRunning ? 'timer-paused' : ''}`}>
          <svg width={size} height={size}>
            {/* Define gradients */}
            <defs>
              <linearGradient id="backgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#f0f8ff" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="25%" stopColor="#f0f8ff" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#e6f3ff" stopOpacity="0.9" />
                <stop offset="75%" stopColor="#cce7ff" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
              </linearGradient>
              
              {/* Add radial gradient for enhanced depth */}
              <radialGradient id="glowGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
                <stop offset="70%" stopColor="#e6f3ff" stopOpacity="0.1" />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>
              
              {/* Add filter for enhanced glow effect */}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Background circle - White Donut */}
            <circle
              cx={center} cy={center} r={radius}
              className="timer-bg-circle"
            />
            
            {/* Progress circle with enhanced effects */}
            <circle
              cx={center} cy={center} r={radius}
              className="timer-progress-circle"
              strokeDasharray={2 * Math.PI * radius}
              strokeDashoffset={(1 - progress) * 2 * Math.PI * radius}
              filter="url(#glow)"
            />
          </svg>
          <div className="pomodoro-timer-text">
            {format(secondsLeft)}
          </div>
        </div>
        <div className="pomodoro-controls">
          <button className="pomodoro-btn start" onClick={() => setIsRunning(true)} disabled={isRunning}>
            <i className="bi bi-play-fill"></i> Start
          </button>
          <button className="pomodoro-btn pause" onClick={() => setIsRunning(false)} disabled={!isRunning}>
            <i className="bi bi-pause-fill"></i> Pause
          </button>
          <button className="pomodoro-btn reset" onClick={() => { setSecondsLeft(SESSION_TYPES[sessionIdx].duration); setIsRunning(false); }}>
            <i className="bi bi-arrow-counterclockwise"></i> Reset
          </button>
        </div>
        <div className="pomodoro-quote">
          <i className="bi bi-chat-quote"></i> {QUOTES[quoteIdx]}
        </div>
        <div className="pomodoro-session-info">
          <span>Completed Sessions: <b>{completed}</b></span>
        </div>
      </div>
    </div>
  );
}

export default PomodoroTimer; 