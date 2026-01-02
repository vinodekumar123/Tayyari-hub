'use client';

import React, { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';
import { Button } from '@/components/ui/button';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useUserStore } from '@/stores/useUserStore';
import { toast } from 'sonner';

// Dynamic import to avoid SSR issues with Quill
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

interface RichTextEditorProps {
    value: string;
    onChange: (content: string) => void;
    placeholder?: string;
    readOnly?: boolean;
    className?: string;
}

export default function RichTextEditor({ value, onChange, placeholder, readOnly = false, className }: RichTextEditorProps) {
    const quillRef = useRef<any>(null);
    const { user } = useUserStore();
    const [uploading, setUploading] = useState(false);

    // Custom Image Handler
    const imageHandler = () => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = async () => {
            const file = input.files ? input.files[0] : null;
            if (!file) return;

            if (!user) {
                toast.error("You must be logged in to upload images.");
                return;
            }

            try {
                setUploading(true);
                const storage = getStorage();
                const storageRef = ref(storage, `community-uploads/${user.uid}/${Date.now()}_${file.name}`);

                const snapshot = await uploadBytes(storageRef, file);
                const url = await getDownloadURL(snapshot.ref);

                const editor = quillRef.current.getEditor();
                const range = editor.getSelection();
                editor.insertEmbed(range.index, 'image', url);

                toast.success("Image uploaded successfully");
            } catch (error) {
                console.error("Image upload failed:", error);
                toast.error("Failed to upload image. Please try again.");
            } finally {
                setUploading(false);
            }
        };
    };

    const modules = useMemo(() => ({
        toolbar: {
            container: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['link', 'image', 'code-block'],
                ['clean']
            ],
            handlers: {
                image: imageHandler
            }
        },
        clipboard: {
            matchVisual: false,
        }
    }), []);

    const formats = [
        'header',
        'bold', 'italic', 'underline', 'strike',
        'list', 'bullet',
        'link', 'image', 'code-block'
    ];

    return (
        <div className={`relative ${className}`}>
            {uploading && (
                <div className="absolute inset-0 z-10 bg-white/50 dark:bg-black/50 flex items-center justify-center backdrop-blur-sm rounded-md">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm font-medium">Uploading image...</span>
                    </div>
                </div>
            )}
            <div className="rich-text-editor-wrapper">
                <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={value}
                    onChange={onChange}
                    modules={modules}
                    formats={formats}
                    placeholder={placeholder}
                    readOnly={readOnly || uploading}
                    className="bg-background text-foreground rounded-md"
                />
            </div>
            {/* Custom styles for Quill to match Shadcn/Tailwind roughly */}
            <style jsx global>{`
                .ql-toolbar {
                    border-top-left-radius: 0.5rem;
                    border-top-right-radius: 0.5rem;
                    border-color: hsl(var(--border)) !important;
                    background-color: hsl(var(--muted) / 0.5);
                }
                .ql-container {
                    border-bottom-left-radius: 0.5rem;
                    border-bottom-right-radius: 0.5rem;
                    border-color: hsl(var(--border)) !important;
                    min-height: 150px;
                    font-size: 1rem;
                }
                .ql-editor {
                    min-height: 150px;
                }
                .dark .ql-toolbar .ql-stroke {
                    stroke: hsl(var(--foreground));
                }
                .dark .ql-toolbar .ql-fill {
                    fill: hsl(var(--foreground));
                }
                .dark .ql-toolbar .ql-picker {
                    color: hsl(var(--foreground));
                }
            `}</style>
        </div>
    );
}
