'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { glassmorphism } from '@/lib/design-tokens';
import ReactMarkdown from 'react-markdown';
import { generateSchedulePDF } from '@/utils/generate-schedule-pdf';
import { Download } from 'lucide-react';


interface Message {
    role: 'user' | 'model';
    text: string;
    action?: string;
}

export function HelpChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', text: 'Welcome to Tayyari Hub! I can help you with course details, pricing, and general questions. How can I assist you today?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const checkAndTriggerActions = (text: string) => {
        if (text.includes("###ACTION:DOWNLOAD_SCHEDULE_OPTIONS###")) {
            return {
                cleanText: text.replace(/###ACTION:DOWNLOAD_SCHEDULE_OPTIONS###/g, "").trim(),
                action: 'DOWNLOAD_SCHEDULE_OPTIONS'
            };
        }
        if (text.includes("###ACTION:DOWNLOAD_SCHEDULE###")) {
            return {
                cleanText: text.replace(/###ACTION:DOWNLOAD_SCHEDULE###/g, "").trim(),
                action: 'DOWNLOAD_SCHEDULE_OPTIONS' // Default to options now to be safe
            };
        }
        return { cleanText: text, action: null };
    };




    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setLoading(true);

        try {
            const response = await fetch('/api/chat-support', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg, history: messages })
            });

            const data = await response.json();

            if (data.error) {
                setMessages(prev => [...prev, { role: 'model', text: `⚠️ Error: ${data.error}` }]);
            } else {
                const { cleanText, action } = checkAndTriggerActions(data.response);
                setMessages(prev => [...prev, { role: 'model', text: cleanText, action }]);
            }

        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', text: "Network error. Please try again or contact Admin via WhatsApp." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <Card className={cn(
                    "w-[350px] sm:w-[400px] h-[500px] mb-4 shadow-2xl border-2 border-blue-500/20 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300",
                    glassmorphism.light
                )}>
                    <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-500 p-4 shrink-0">
                        <div className="flex justify-between items-center text-white">
                            <div className="flex items-center gap-2">
                                <div className="bg-white/20 p-1.5 rounded-full">
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-base">Tayyari Assistant</CardTitle>
                                    <p className="text-xs text-blue-100 opacity-90">AI Support Bot</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="hover:bg-white/20 text-white h-8 w-8" onClick={() => setIsOpen(false)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                        {messages.map((msg, idx) => (
                            <div key={idx} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                                <div className={cn(
                                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                                    msg.role === 'user'
                                        ? "bg-blue-600 text-white rounded-br-none"
                                        : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none"
                                )}>
                                    <ReactMarkdown
                                        className="prose prose-sm dark:prose-invert max-w-none break-words"
                                        components={{
                                            p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                                            a: ({ node, ...props }) => <a className="text-blue-200 underline" target="_blank" {...props} />
                                        }}
                                    >
                                        {msg.text}
                                    </ReactMarkdown>

                                    {/* Action Buttons: Download Options */}
                                    {msg.action === 'DOWNLOAD_SCHEDULE_OPTIONS' && (
                                        <div className="flex flex-col gap-2 mt-3 w-full">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full border-blue-200 hover:bg-blue-50 text-blue-600 gap-2 justify-start"
                                                onClick={() => generateSchedulePDF('fresher')}
                                            >
                                                <Download className="w-4 h-4" />
                                                Download Fresher Series
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full border-emerald-200 hover:bg-emerald-50 text-emerald-600 gap-2 justify-start"
                                                onClick={() => generateSchedulePDF('improver')}
                                            >
                                                <Download className="w-4 h-4" />
                                                Download Improver Series
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start w-full">
                                <div className="bg-white dark:bg-slate-800 border px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                    <span className="text-xs text-muted-foreground">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </CardContent>

                    <div className="p-3 bg-white/50 dark:bg-slate-900/50 border-t backdrop-blur-sm">
                        <div className="relative flex items-center">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type a question..."
                                className="pr-12 rounded-full border-slate-200 dark:border-slate-700 focus-visible:ring-blue-500"
                            />
                            <Button
                                size="icon"
                                className="absolute right-1 h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700"
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                            >
                                <Send className="w-4 h-4 text-white" />
                            </Button>
                        </div>
                        <div className="text-[10px] text-center text-muted-foreground mt-2">
                            Displaying live info from Tayyari Hub. AI can make mistakes. Please verify important details.
                        </div>
                    </div>
                </Card>
            )}

            {/* Toggle Button */}
            <Button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "h-14 w-14 rounded-full shadow-xl bg-gradient-to-tr from-blue-600 to-cyan-500 hover:brightness-110 transition-all duration-300",
                    isOpen ? "rotate-90 scale-0 opacity-0" : "scale-100 opacity-100"
                )}
            >
                <MessageCircle className="w-7 h-7 text-white" />
            </Button>
        </div>
    );
}
