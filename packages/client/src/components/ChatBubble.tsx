// packages/client/src/components/ChatBubble.tsx
import { useEffect, useState } from 'react';

interface ChatBubbleProps {
  nickname: string;
  message: string;
  isMine: boolean;
}

export default function ChatBubble({ nickname, message, isMine }: ChatBubbleProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`animate-bubble-in rounded-lg px-2 py-1 text-xs sm:text-sm max-w-40 sm:max-w-52 ${
        isMine ? 'bg-blue-600 text-white self-end' : 'bg-gray-700 text-white self-start'
      }`}
    >
      <span className="font-semibold text-yellow-300 text-[10px] sm:text-xs">{nickname}</span>
      <p className="leading-tight">{message}</p>
    </div>
  );
}
