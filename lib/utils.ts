export function getRelativeTime(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays}d ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears}y ago`;
}

export const typeDescriptions: Record<string, string> = {
  board: '🛹 Skateboard',
  wheels: '🔄 Wheels',
  trucks: '🛠️ Trucks',
  bearings: '⚙️ Bearings',
  griptape: '📏 Griptape',
  hardware: '🔧 Hardware',
  tools: '🛠️ Tools',
  accessories: '🎯 Accessories',
  clothing: '👕 Clothing',
  other: '📦 Other'
};

export const conditionDescriptions: Record<string, string> = {
  new: '✨ Brand New',
  like_new: '🌟 Like New',
  good: '👍 Good',
  fair: '👌 Fair',
  poor: '⚠️ Poor'
}; 