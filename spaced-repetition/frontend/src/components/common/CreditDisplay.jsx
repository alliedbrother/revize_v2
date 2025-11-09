import React from 'react';
import { Badge } from 'react-bootstrap';
import './CreditDisplay.css';

/**
 * CreditDisplay Component
 * Displays user's credit balance or unlimited access badge
 *
 * @param {number} credits - Number of available credits
 * @param {boolean} unlimitedAccess - Whether user has unlimited access
 * @param {string} size - Badge size: 'sm', 'md', 'lg' (default: 'md')
 * @param {boolean} showLabel - Whether to show "credits" label (default: true)
 */
const CreditDisplay = ({ credits, unlimitedAccess, size = 'md', showLabel = true }) => {
  // Determine badge variant based on credit count
  const getBadgeVariant = () => {
    if (unlimitedAccess) return 'success';
    if (credits > 5) return 'primary';
    if (credits > 0) return 'warning';
    return 'danger';
  };

  // Determine icon based on status
  const getIcon = () => {
    if (unlimitedAccess) return 'bi-infinity';
    if (credits > 5) return 'bi-lightning-charge-fill';
    if (credits > 0) return 'bi-battery-half';
    return 'bi-battery';
  };

  const sizeClass = `credit-badge-${size}`;

  if (unlimitedAccess) {
    return (
      <Badge bg={getBadgeVariant()} className={`credit-badge ${sizeClass}`}>
        <i className={`${getIcon()} me-1`}></i>
        Unlimited
      </Badge>
    );
  }

  return (
    <Badge bg={getBadgeVariant()} className={`credit-badge ${sizeClass}`}>
      <i className={`${getIcon()} me-1`}></i>
      {credits} {showLabel && 'credits'}
    </Badge>
  );
};

export default CreditDisplay;
