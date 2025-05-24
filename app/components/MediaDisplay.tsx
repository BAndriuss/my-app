'use client';

import { useState, useEffect } from 'react';

interface MediaDisplayProps {
  url: string;
  className?: string;
}

export default function MediaDisplay({ url, className = '' }: MediaDisplayProps) {
  const [isVideo, setIsVideo] = useState<boolean | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Check if the URL ends with common video extensions
    const videoExtensions = ['.mp4', '.mov', '.MOV', '.MP4'];
    setIsVideo(videoExtensions.some(ext => url.toLowerCase().endsWith(ext.toLowerCase())));
  }, [url]);

  if (isVideo === null) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <span className="description-text">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <span className="description-text text-red-500">Failed to load media</span>
      </div>
    );
  }

  return isVideo ? (
    <video
      className={`w-full h-full object-cover ${className}`}
      controls
      preload="metadata"
      onError={() => setError(true)}
    >
      <source src={url} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  ) : (
    <img
      src={url}
      alt="Tournament submission"
      className={`w-full h-full object-cover ${className}`}
      onError={() => setError(true)}
    />
  );
} 