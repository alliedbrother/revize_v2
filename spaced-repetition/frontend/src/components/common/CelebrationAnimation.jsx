import React, { useState, useEffect } from 'react';
import './CelebrationAnimation.css';

const CelebrationAnimation = ({ show, onComplete }) => {
  const [currentBlast, setCurrentBlast] = useState(0);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    if (show) {
      setShowMessage(true);
      setCurrentBlast(0);
      
      // Start the three blasts sequence
      const startBlasts = () => {
        // First blast immediately
        setCurrentBlast(1);
        
        // Second blast after 800ms
        setTimeout(() => {
          setCurrentBlast(2);
        }, 800);
        
        // Third blast after 1600ms
        setTimeout(() => {
          setCurrentBlast(3);
        }, 1600);
      };
      
      startBlasts();
      
      // Complete the animation after all blasts
      setTimeout(() => {
        setShowMessage(false);
        setCurrentBlast(0);
        if (onComplete) onComplete();
      }, 4500); // Total duration: 4.5 seconds
    }
  }, [show, onComplete]);

  if (!show) return null;

  // Generate flower petals for each blast
  const generatePetals = (blastIndex) => {
    const petals = [];
    const petalCount = 25; // 25 petals per blast
    const colors = [
      '#FF6B9D', '#FFB347', '#87CEEB', '#98FB98', '#DDA0DD',
      '#F0E68C', '#FFA07A', '#20B2AA', '#FF69B4', '#32CD32',
      '#FFD700', '#FF1493', '#00CED1', '#ADFF2F', '#FF4500'
    ];
    
    for (let i = 0; i < petalCount; i++) {
      const angle = (360 / petalCount) * i + Math.random() * 20 - 10; // Add some randomness
      const distance = 200 + Math.random() * 300;
      const size = 10 + Math.random() * 15;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const duration = 2.5 + Math.random() * 1.5;
      const delay = blastIndex * 0.8 + Math.random() * 0.4;
      
      petals.push(
        <div
          key={`${blastIndex}-${i}`}
          className="flower-petal"
          style={{
            '--angle': `${angle}deg`,
            '--distance': `${distance}px`,
            '--size': `${size}px`,
            '--color': color,
            '--duration': `${duration}s`,
            '--delay': `${delay}s`,
            left: '50%',
            top: '15%', // Start from banner area
          }}
        />
      );
    }
    return petals;
  };

  return (
    <div className="celebration-overlay">
      {/* Congratulatory Message */}
      {showMessage && (
        <div className="celebration-message">
          <h1 className="great-job-text">Great job!</h1>
          <div className="celebration-sparkles">
            {[...Array(8)].map((_, i) => (
              <div key={i} className={`sparkle sparkle-${i + 1}`}>✨</div>
            ))}
          </div>
        </div>
      )}
      
      {/* Flower Cracker Blasts */}
      <div className="flower-crackers">
        {[0, 1, 2].map(blastIndex => (
          <div key={blastIndex} className="cracker-blast">
            {currentBlast > blastIndex && generatePetals(blastIndex)}
          </div>
        ))}
      </div>
      
      {/* Cracker Source Animation */}
      {currentBlast > 0 && (
        <div className="cracker-source">
          <div className="cracker-body"></div>
          <div className="cracker-explosion"></div>
        </div>
      )}
    </div>
  );
};

export default CelebrationAnimation; 