'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function AdminAiTutorTestPage() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hello! I am your AI Tutor Test Environment. I have access to your uploaded Books and PMDC Syllabus. How can I help?' }
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
                <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                            {messages.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-lg p-3 ${m.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-900 border border-slate-200'
                                        }`}>
                                        <ReactMarkdown className="prose prose-sm dark:prose-invert">
                                            {m.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-100 rounded-lg p-3">
                                        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                                    </div>
                                </div>
                            )}
                            <div ref={scrollEndRef} />
                        </div>
                    </ScrollArea>

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
