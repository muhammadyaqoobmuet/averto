'use client';

import { Suspense } from 'react';
import ChatbotStudioPage from './ChatbotStudioContent';

export default function ChatbotPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--text)] rounded-full animate-spin" />
        </div>
      }
    >
      <ChatbotStudioPage />
    </Suspense>
  );
}
