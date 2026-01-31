'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function AdminAiTutorTestPage() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hello! I am your AI Tutor Test Environment. I support **Markdown**, $LaTeX$, and tables. How can I help?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollEndRef.current) {
            scrollEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        setLoading(true);
        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInput('');

        try {
            const res = await fetch('/api/admin/chat-tutor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg })
            });

            if (!res.body) throw new Error("No response body");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let assistantMsg = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                assistantMsg += chunk;

                setMessages(prev => {
                    const newArr = [...prev];
                    newArr[newArr.length - 1].content = assistantMsg;
                    return newArr;
                });
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: '❌ Error: Failed to get response.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 h-[calc(100vh-2rem)] flex flex-col">
            <Card className="flex flex-col flex-1 overflow-hidden">
                <CardHeader>
                    <CardTitle>AI Tutor Test Console</CardTitle>
                    <CardDescription>Test the RAG retrieval logic against your uploaded Knowledge Base.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 p-0">
                    <div className="flex-1 overflow-y-auto p-4 scroller">
                        <div className="space-y-6">
                            {messages.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`rounded-xl p-6 shadow-sm ${m.role === 'user'
                                        ? 'bg-blue-600 text-white max-w-[80%]'
                                        : 'bg-white text-slate-900 border border-slate-200 w-full max-w-full'
                                        }`}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                            className={`prose max-w-none break-words ${m.role === 'user' ? 'prose-invert text-white' : 'dark:prose-invert prose-slate'}`}
                                            components={{
                                                // Style tables to be responsive and nice looking
                                                table: ({ ref, ...props }) => (
                                                    <div className="overflow-x-auto my-6 rounded-lg border border-slate-200 shadow-sm">
                                                        <table className="min-w-full divide-y divide-slate-200 bg-white" {...props} />
                                                    </div>
                                                ),
                                                thead: ({ ref, ...props }) => <thead className="bg-slate-50" {...props} />,
                                                tbody: ({ ref, ...props }) => <tbody className="divide-y divide-slate-200 bg-white" {...props} />,
                                                tr: ({ ref, ...props }) => <tr className="hover:bg-slate-50 transition-colors" {...props} />,
                                                th: ({ ref, ...props }) => <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" {...props} />,
                                                td: ({ ref, ...props }) => <td className="px-6 py-4 text-sm text-slate-700 whitespace-pre-wrap" {...props} />,
                                                p: ({ ref, ...props }) => <p className="leading-relaxed [&:not(:first-child)]:mt-4 text-base" {...props} />,
                                                a: ({ ref, ...props }) => <a className="text-blue-600 font-medium hover:underline" {...props} />,
                                                ul: ({ ref, ...props }) => <ul className="list-disc pl-6 my-4 space-y-2" {...props} />,
                                                ol: ({ ref, ...props }) => <ol className="list-decimal pl-6 my-4 space-y-2" {...props} />,
                                                li: ({ ref, ...props }) => <li className="pl-1 leading-relaxed" {...props} />,
                                                h1: ({ ref, ...props }) => <h1 className="text-2xl font-bold mt-8 mb-4 border-b border-slate-200 pb-2" {...props} />,
                                                h2: ({ ref, ...props }) => <h2 className="text-xl font-bold mt-8 mb-4 border-b border-slate-200 pb-2" {...props} />,
                                                h3: ({ ref, ...props }) => <h3 className="text-lg font-bold mt-6 mb-3" {...props} />,
                                                code: ({ ref, ...props }) => <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-pink-600" {...props} />,
                                                blockquote: ({ ref, ...props }) => <blockquote className="border-l-4 border-blue-500 pl-4 my-4 italic text-slate-600 bg-slate-50 py-2 rounded-r" {...props} />,
                                            }}
                                        >
                                            {m.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-100 rounded-lg p-3">
                                        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                                    </div>
                                </div>
                            )}
                            <div ref={scrollEndRef} />
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-200 bg-white">
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                            className="flex gap-2"
                        >
                            <Input
                                placeholder="Ask a question from your books..."
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                disabled={loading}
                            />
                            <Button type="submit" disabled={loading || !input.trim()}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
