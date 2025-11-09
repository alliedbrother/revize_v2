import React from 'react';
import './SkeletonLoader.css';

/**
 * Reusable Skeleton Loader Component
 * Provides visual feedback during content loading
 */

// Basic Skeleton Line
export const SkeletonLine = ({ width = '100%', height = '16px', className = '' }) => {
  return (
    <div
      className={`skeleton skeleton-line ${className}`}
      style={{ width, height }}
    />
  );
};

// Skeleton Text Block (multiple lines)
export const SkeletonText = ({ lines = 3, className = '' }) => {
  return (
    <div className={`skeleton-text ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonLine
          key={index}
          width={index === lines - 1 ? '70%' : '100%'}
          height="14px"
        />
      ))}
    </div>
  );
};

// Skeleton Circle (for avatars)
export const SkeletonCircle = ({ size = '48px', className = '' }) => {
  return (
    <div
      className={`skeleton skeleton-circle ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

// Skeleton Rectangle (for images, cards)
export const SkeletonRectangle = ({ width = '100%', height = '200px', className = '' }) => {
  return (
    <div
      className={`skeleton skeleton-rectangle ${className}`}
      style={{ width, height }}
    />
  );
};

// Skeleton Card
export const SkeletonCard = ({ className = '' }) => {
  return (
    <div className={`skeleton-card ${className}`}>
      <SkeletonRectangle height="120px" />
      <div className="skeleton-card-content">
        <SkeletonLine width="60%" height="20px" />
        <SkeletonText lines={2} />
        <div className="skeleton-card-footer">
          <SkeletonLine width="80px" height="32px" />
          <SkeletonLine width="80px" height="32px" />
        </div>
      </div>
    </div>
  );
};

// Skeleton Topic Card (for AllTopics)
export const SkeletonTopicCard = ({ className = '' }) => {
  return (
    <div className={`skeleton-topic-card ${className}`}>
      <div className="skeleton-topic-header">
        <SkeletonLine width="70%" height="20px" />
        <SkeletonLine width="100px" height="24px" />
      </div>
      <SkeletonText lines={2} />
      <div className="skeleton-topic-footer">
        <SkeletonLine width="120px" height="14px" />
        <div className="skeleton-topic-actions">
          <SkeletonLine width="32px" height="32px" />
          <SkeletonLine width="32px" height="32px" />
          <SkeletonLine width="32px" height="32px" />
        </div>
      </div>
    </div>
  );
};

// Skeleton List Item
export const SkeletonListItem = ({ className = '' }) => {
  return (
    <div className={`skeleton-list-item ${className}`}>
      <SkeletonCircle size="40px" />
      <div className="skeleton-list-content">
        <SkeletonLine width="40%" height="16px" />
        <SkeletonLine width="80%" height="12px" />
      </div>
      <SkeletonLine width="60px" height="32px" />
    </div>
  );
};

// Skeleton Table Row
export const SkeletonTableRow = ({ columns = 4, className = '' }) => {
  return (
    <div className={`skeleton-table-row ${className}`}>
      {Array.from({ length: columns }).map((_, index) => (
        <SkeletonLine
          key={index}
          width={index === 0 ? '30%' : index === columns - 1 ? '15%' : '20%'}
          height="14px"
        />
      ))}
    </div>
  );
};

// Full Page Skeleton
export const SkeletonPage = ({ className = '' }) => {
  return (
    <div className={`skeleton-page ${className}`}>
      <div className="skeleton-page-header">
        <SkeletonLine width="200px" height="32px" />
        <SkeletonLine width="300px" height="14px" />
      </div>
      <div className="skeleton-page-content">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
};

// Skeleton Grid (for topic grids)
export const SkeletonGrid = ({ items = 6, className = '' }) => {
  return (
    <div className={`skeleton-grid ${className}`}>
      {Array.from({ length: items }).map((_, index) => (
        <SkeletonTopicCard key={index} />
      ))}
    </div>
  );
};

export default SkeletonLine;
