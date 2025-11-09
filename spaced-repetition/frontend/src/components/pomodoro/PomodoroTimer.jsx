import { useState, useRef, useEffect } from 'react';
import './Pomodoro.css';

const SESSION_TYPES = [
  { key: 'focus', label: 'Focus', duration: 25 * 60, color: 'rgba(0, 188, 212, 0.15)' },
  { key: 'short', label: 'Short Break', duration: 5 * 60, color: 'rgba(0, 188, 212, 0.15)' },
  { key: 'long', label: 'Long Break', duration: 15 * 60, color: 'rgba(0, 212, 170, 0.15)' },
];

const QUOTES = [
  "Stay focused, you're doing great!",
  "Small steps every day!",
  "Breaks help your brain grow.",
  "Deep breaths, deep focus.",
  "You've got this!"
];

function PomodoroTimer({ compact = false, collapsed = false, onToggleCollapse }) {
  const [sessionIdx, setSessionIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_TYPES[0].duration);
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const intervalRef = useRef(null);


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

  // ESC key handler for zen mode
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    if (isExpanded) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isExpanded]);

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
    <>
      <div className="pomodoro-main">
        <div className={`pomodoro-card ${compact ? 'compact' : ''} ${collapsed ? 'collapsed' : ''}`}>
          {compact && !collapsed && (
            <>
              <button
                className="pomodoro-expand-btn"
                onClick={() => setIsExpanded(true)}
                aria-label="Expand timer to full screen"
                title="Zen mode"
              >
                <i className="bi bi-arrows-fullscreen"></i>
              </button>
              {onToggleCollapse && (
                <button
                  className="pomodoro-collapse-btn"
                  onClick={onToggleCollapse}
                  aria-label={collapsed ? "Expand timer" : "Minimize timer"}
                  title={collapsed ? "Expand timer" : "Minimize timer"}
                >
                  <i className={`bi ${collapsed ? 'bi-chevron-down' : 'bi-chevron-up'}`}></i>
                </button>
              )}
            </>
          )}

          {/* Collapsed state with gradient card */}
          {collapsed ? (
            <div className="pomodoro-collapsed-content">
              <button
                className={`pomodoro-collapsed-play-btn ${isRunning ? 'running' : ''}`}
                onClick={() => setIsRunning(!isRunning)}
                aria-label={isRunning ? "Pause timer" : "Start timer"}
                title={isRunning ? "Pause timer" : "Start timer"}
              >
                <i className={`bi ${isRunning ? 'bi-pause-fill' : 'bi-play-fill'}`}></i>
              </button>
              <div className="pomodoro-collapsed-info">
                <div className="pomodoro-timer-display">
                  <div className="pomodoro-timer-text">
                    {format(secondsLeft)}
                  </div>
                </div>
              </div>
              {onToggleCollapse && (
                <button
                  className="pomodoro-collapsed-expand-btn"
                  onClick={onToggleCollapse}
                  aria-label="Expand timer"
                  title="Expand timer"
                >
                  <i className="bi bi-chevron-down"></i>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="pomodoro-header">
                <h3 className="pomodoro-title">Pomodoro Timer</h3>
              </div>

              {/* Timer Display - Always visible */}
              <div className="pomodoro-timer-display">
                <div className="pomodoro-timer-text">
                  {format(secondsLeft)}
                </div>
              </div>
            </>
          )}

          {!collapsed && (
            <>
              <div className="pomodoro-session-tabs">
              {SESSION_TYPES.map((s, i) => (
                <button
                  key={s.key}
                  className={`pomodoro-tab${i === sessionIdx ? ' active' : ''}`}
                  onClick={() => handleSession(i)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {/* Linear Progress Bar */}
            <div className="pomodoro-progress-bar-container">
              <div
                className="pomodoro-progress-bar-fill"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            </>
          )}

        {!collapsed && (
          <div className="pomodoro-controls">
          <button
            className="pomodoro-btn start"
            onClick={() => setIsRunning(true)}
            disabled={isRunning}
            aria-label="Start timer"
          >
            <i className="bi bi-play-fill"></i>
            <span className="pomodoro-btn-text">Start</span>
          </button>
          <button
            className="pomodoro-btn pause"
            onClick={() => setIsRunning(false)}
            disabled={!isRunning}
            aria-label="Pause timer"
          >
            <i className="bi bi-pause-fill"></i>
            <span className="pomodoro-btn-text">Pause</span>
          </button>
          <button
            className="pomodoro-btn reset"
            onClick={() => { setSecondsLeft(SESSION_TYPES[sessionIdx].duration); setIsRunning(false); }}
            aria-label="Reset timer"
          >
            <i className="bi bi-arrow-counterclockwise"></i>
            <span className="pomodoro-btn-text">Reset</span>
          </button>
        </div>
        )}
        {!compact && (
          <>
            <div className="pomodoro-quote">
              <i className="bi bi-chat-quote"></i> {QUOTES[quoteIdx]}
            </div>
            <div className="pomodoro-session-info">
              <span>Completed Sessions: <b>{completed}</b></span>
            </div>
          </>
        )}
      </div>
    </div>

    {/* Zen Mode Overlay */}
    {isExpanded && (
      <div className="pomodoro-zen-overlay" onClick={() => setIsExpanded(false)}>
        <div className="pomodoro-zen-content" onClick={(e) => e.stopPropagation()}>
          <button
            className="pomodoro-zen-close"
            onClick={() => setIsExpanded(false)}
            aria-label="Close zen mode"
          >
            <i className="bi bi-x-lg"></i>
          </button>

          <h2 className="pomodoro-zen-session-label">
            {SESSION_TYPES[sessionIdx].label}
          </h2>

          <div className="pomodoro-zen-timer">
            {format(secondsLeft)}
          </div>

          <div className="pomodoro-zen-progress">
            <div
              className="pomodoro-zen-progress-fill"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <div className="pomodoro-zen-controls">
            <button
              className="pomodoro-zen-btn start"
              onClick={() => setIsRunning(true)}
              disabled={isRunning}
              aria-label="Start timer"
            >
              <i className="bi bi-play-fill"></i>
            </button>
            <button
              className="pomodoro-zen-btn pause"
              onClick={() => setIsRunning(false)}
              disabled={!isRunning}
              aria-label="Pause timer"
            >
              <i className="bi bi-pause-fill"></i>
            </button>
            <button
              className="pomodoro-zen-btn reset"
              onClick={() => { setSecondsLeft(SESSION_TYPES[sessionIdx].duration); setIsRunning(false); }}
              aria-label="Reset timer"
            >
              <i className="bi bi-arrow-counterclockwise"></i>
            </button>
          </div>

          <div className="pomodoro-zen-quote">
            <i className="bi bi-chat-quote"></i> {QUOTES[quoteIdx]}
          </div>

          <div className="pomodoro-zen-completed">
            Completed Sessions: <strong>{completed}</strong>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default PomodoroTimer; 