'use client';

import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';
import { Skeleton } from '@/components/ui/skeleton';

// Dynamic import to avoid SSR issues with Quill
const ReactQuill = dynamic(() => import('react-quill-new'), {
    ssr: false,
    loading: () => <Skeleton className="h-[200px] w-full rounded-md" />,
});

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

const modules = {
    toolbar: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link'],
        ['clean']
    ],
};

const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list',
    'link'
];

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
    return (
        <div className={`rich-text-editor-wrapper ${className}`}>
            <ReactQuill
                theme="snow"
                value={value}
                onChange={onChange}
                modules={modules}
                formats={formats}
                placeholder={placeholder}
                className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-slate-800"
            />
            <style jsx global>{`
                .ql-toolbar.ql-snow {
                    border-top-left-radius: 0.5rem;
                    border-top-right-radius: 0.5rem;
                    border-color: rgba(226, 232, 240, 0.8) !important;
                }
                .dark .ql-toolbar.ql-snow {
                    border-color: rgba(30, 41, 59, 0.8) !important;
                }
                .ql-container.ql-snow {
                    border-bottom-left-radius: 0.5rem;
                    border-bottom-right-radius: 0.5rem;
                    border-color: rgba(226, 232, 240, 0.8) !important;
                    min-height: 150px;
                }
                .dark .ql-container.ql-snow {
                    border-color: rgba(30, 41, 59, 0.8) !important;
                }
                .ql-editor.ql-blank::before {
                    color: #94a3b8;
                    font-style: normal;
                }
                .dark .ql-snow .ql-stroke {
                    stroke: #cbd5e1;
                }
                .dark .ql-snow .ql-fill {
                    fill: #cbd5e1;
                }
                .dark .ql-snow .ql-picker {
                    color: #cbd5e1;
                }
            `}</style>
        </div>
    );
}
