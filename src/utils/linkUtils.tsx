/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * Transforms plain text containing http/https URLs into text with clickable <a> links.
 */
export function renderTextWithLinks(text: string | undefined | null) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 underline font-semibold break-all transition-colors"
        >
          <span>{part}</span>
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
