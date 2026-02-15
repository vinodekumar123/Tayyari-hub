'use client';

import React, { useMemo } from 'react';
import DOMPurify from 'isomorphic-dompurify';

interface SanitizedContentProps extends React.HTMLAttributes<HTMLDivElement> {
    content: string;
    as?: any;
}

export const SanitizedContent = ({ content, as: Component = 'div', ...props }: SanitizedContentProps) => {
    const sanitizedHTML = useMemo(() => {
        return DOMPurify.sanitize(content);
    }, [content]);

    return (
        <Component
            {...props}
            dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
        />
    );
};
