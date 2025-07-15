import React from 'react';
import './WaveBottom.css';

const WaveBottom = ({ 
  className = '', 
  fillColor = 'var(--tab-bg)', 
  height = 30 
}) => {
  return (
    <div className={`wave-bottom ${className}`}>
      <svg 
        className="wave-svg" 
        viewBox="0 0 1200 40" 
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M0,20 C300,5 600,35 900,15 C1050,5 1150,25 1200,20 L1200,40 L0,40 Z"
          fill={fillColor}
          className="wave-path"
        />
      </svg>
    </div>
  );
};

export default WaveBottom; 