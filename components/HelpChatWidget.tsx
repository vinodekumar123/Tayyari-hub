'use client';

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, X, Send, Bot, Loader2, Minimize2, Download, Maximize2, Sparkles, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { glassmorphism } from '@/lib/design-tokens';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { generateSchedulePDF } from '@/utils/generate-schedule-pdf';

interface Message {
    role: 'user' | 'model';
    text: string;
    action?: string;
    feedback?: 'helpful' | 'not_helpful';
}

const STORAGE_KEY = 'tayyari_chat_history';

// Load chat history from localStorage
function loadChatHistory(): Message[] {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.error('Failed to load chat history:', e);
    }
    return [];
}

// Save chat history to localStorage
function saveChatHistory(messages: Message[]) {
    if (typeof window === 'undefined') return;
    try {
        // Only save last 20 messages to prevent bloat
        const toSave = messages.slice(-20);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.error('Failed to save chat history:', e);
    }
}

// Memoized message component for performance
const ChatMessage = memo(({ msg, index, onFeedback }: {
    msg: Message;
    index: number;
    onFeedback: (index: number, feedback: 'helpful' | 'not_helpful') => void;
}) => (
    <div className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
        <div className={cn(
            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
            msg.role === 'user'
                ? "bg-blue-600 text-white rounded-br-none"
                : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none"
        )}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                className="prose prose-sm dark:prose-invert max-w-none break-words"
                components={{
                    p: ({ node, ...props }) => <p className="mb-1 last:mb-0 leading-relaxed" {...props} />,
                    a: ({ node, ...props }) => <a className={cn(
                        msg.role === 'user' ? "text-blue-200" : "text-blue-600",
                        "underline"
                    )} target="_blank" {...props} />,
                    table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-2 rounded border border-slate-200 dark:border-slate-700">
                            <table className="min-w-full text-xs" {...props} />
                        </div>
                    ),
                    th: ({ node, ...props }) => <th className="px-2 py-1 bg-slate-50 dark:bg-slate-700 text-left font-medium" {...props} />,
                    td: ({ node, ...props }) => <td className="px-2 py-1 border-t border-slate-100 dark:border-slate-600" {...props} />,
                    code: ({ node, ...props }) => <code className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-xs" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 my-1 space-y-0.5" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 my-1 space-y-0.5" {...props} />,
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

            {/* Feedback buttons for model messages */}
            {msg.role === 'model' && !msg.action && msg.text.length > 50 && (
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 mr-1">Helpful?</span>
                    <button
                        onClick={() => onFeedback(index, 'helpful')}
                        className={cn(
                            "p-1 rounded transition-colors",
                            msg.feedback === 'helpful'
                                ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                                : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                        )}
                    >
                        <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button
                        onClick={() => onFeedback(index, 'not_helpful')}
                        className={cn(
                            "p-1 rounded transition-colors",
                            msg.feedback === 'not_helpful'
                                ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400"
                                : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                        )}
                    >
                        <ThumbsDown className="w-3 h-3" />
                    </button>
                </div>
            )}
        </div>
    </div>
));
ChatMessage.displayName = 'ChatMessage';

const WELCOME_MESSAGE: Message = {
    role: 'model',
    text: 'Welcome to Tayyari Hub! 👋 I can help you with course details, pricing, and general questions. How can I assist you today?'
};

export function HelpChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Load saved messages on mount
    useEffect(() => {
        const saved = loadChatHistory();
        if (saved.length > 0) {
            setMessages(saved);
        }
        setIsInitialized(true);
    }, []);

    // Save messages when they change
    useEffect(() => {
        if (isInitialized && messages.length > 0) {
            saveChatHistory(messages);
        }
    }, [messages, isInitialized]);

    // Detect mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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
                action: 'DOWNLOAD_SCHEDULE_OPTIONS'
            };
        }
        return { cleanText: text, action: null };
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen, isFullScreen]);

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

    const handleFeedback = useCallback((index: number, feedback: 'helpful' | 'not_helpful') => {
        setMessages(prev => {
            const newArr = [...prev];
            newArr[index] = { ...newArr[index], feedback };
            return newArr;
        });
    }, []);

    const clearChat = () => {
        setMessages([WELCOME_MESSAGE]);
        localStorage.removeItem(STORAGE_KEY);
    };

    const pathname = usePathname();
    const allowedPaths = ['/', '/series/fresher', '/series/improver', '/about', '/contact'];

    if (!allowedPaths.includes(pathname)) {
        return null;
    }

    const effectiveFullScreen = isFullScreen || (isMobile && isOpen);

    return (
        <div className={cn(
            "fixed z-50 flex flex-col items-end transition-all duration-300",
            effectiveFullScreen ? "inset-0" : "bottom-6 right-6"
        )}>
            {/* Chat Window */}
            {isOpen && (
                <Card className={cn(
                    "shadow-2xl border-2 border-blue-500/20 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300",
                    glassmorphism.light,
                    effectiveFullScreen
                        ? "w-full h-full rounded-none"
                        : "w-[350px] sm:w-[400px] h-[500px] mb-4 rounded-xl"
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
                            <div className="flex items-center gap-1">
                                {messages.length > 1 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="hover:bg-white/20 text-white h-8 w-8"
                                        onClick={clearChat}
                                        title="Clear Chat"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                                {!isMobile && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="hover:bg-white/20 text-white h-8 w-8"
                                        onClick={() => setIsFullScreen(!isFullScreen)}
                                        title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                                    >
                                        {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="hover:bg-white/20 text-white h-8 w-8"
                                    onClick={() => {
                                        setIsOpen(false);
                                        setIsFullScreen(false);
                                    }}
                                >
                                    {isMobile ? <Minimize2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900" ref={scrollRef}>
                        {messages.map((msg, idx) => (
                            <ChatMessage key={idx} msg={msg} index={idx} onFeedback={handleFeedback} />
                        ))}
                        {loading && (
                            <div className="flex justify-start w-full">
                                <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                    <span className="text-xs text-muted-foreground">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </CardContent>

                    <div className="p-3 bg-white/80 dark:bg-slate-900/80 border-t dark:border-slate-700 backdrop-blur-sm">
                        <div className="relative flex items-center">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type a question..."
                                className={cn(
                                    "pr-12 rounded-full border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus-visible:ring-blue-500",
                                    isMobile && "text-base h-12"
                                )}
                            />
                            <Button
                                size="icon"
                                className={cn(
                                    "absolute right-1 rounded-full bg-blue-600 hover:bg-blue-700",
                                    isMobile ? "h-10 w-10" : "h-8 w-8"
                                )}
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                            >
                                <Send className="w-4 h-4 text-white" />
                            </Button>
                        </div>
                        <div className="text-[10px] text-center text-muted-foreground mt-2">
                            AI can make mistakes. Please verify important details.
                        </div>
                    </div>
                </Card>
            )}

            {/* Toggle Button & CTA */}
            {!isOpen && (
                <div className="flex flex-col items-end gap-3 group">
                    {/* CTA Tooltip/Label */}
                    <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-2xl shadow-xl border border-blue-100 dark:border-slate-700 animate-bounce-subtle mb-1 transform transition-all duration-300 group-hover:scale-105">
                        <p className="text-xs font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-blue-500" />
                            Need any help?
                        </p>
                    </div>

                    <Button
                        onClick={() => setIsOpen(true)}
                        className={cn(
                            "h-16 w-16 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)] bg-gradient-to-tr from-blue-600 via-blue-500 to-cyan-400 hover:scale-110 hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] transition-all duration-300 flex items-center justify-center border-2 border-white/20 relative overflow-hidden group/btn"
                        )}
                    >
                        {/* Animated Background Glow */}
                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />

                        <div className="relative">
                            <Bot className="w-8 h-8 text-white animate-pulse-slow" />
                            <div className="absolute -top-1 -right-1">
                                <Sparkles className="w-4 h-4 text-yellow-300 animate-spin-slow" />
                            </div>
                        </div>

                        {/* Ripple Effect Element */}
                        <div className="absolute inset-0 rounded-full animate-ping-slow border-4 border-blue-400/30 pointer-events-none" />
                    </Button>
                </div>
            )}
        </div>
    );
}

// Custom Animations for the Chatbot
const customStyles = `
@keyframes bounce-subtle {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
}
@keyframes pulse-slow {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.9; }
}
@keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
@keyframes ping-slow {
    75%, 100% { transform: scale(1.4); opacity: 0; }
}
.animate-bounce-subtle { animation: bounce-subtle 3s infinite ease-in-out; }
.animate-pulse-slow { animation: pulse-slow 3s infinite ease-in-out; }
.animate-spin-slow { animation: spin-slow 8s infinite linear; }
.animate-ping-slow { animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite; }
`;

// Inject styles for immediate effect
if (typeof document !== 'undefined') {
    const styleTag = document.getElementById('chat-widget-styles') || document.createElement('style');
    styleTag.id = 'chat-widget-styles';
    styleTag.innerHTML = customStyles;
    document.head.appendChild(styleTag);
}
