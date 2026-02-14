'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Send, ThumbsUp, ThumbsDown, Sparkles, BookOpen, ListChecks, GitCompare, HelpCircle, RotateCcw, User, UserCog } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    feedback?: 'helpful' | 'not_helpful';
    logId?: string; // Added logId for feedback
    metadata?: {
        confidence?: string;
        subject?: string;
        intent?: string;
        sourcesCount?: number;
    };
}

interface StreamStatus {
    status: string;
    message: string;
}

const QUICK_ACTIONS = [
    { label: 'Explain', icon: BookOpen, prompt: 'Explain in detail: ' },
    { label: 'Explain Simply', icon: Sparkles, prompt: 'Explain like I am 5: ' },
    { label: 'Short Answer', icon: ListChecks, prompt: 'Briefly define: ' },
    { label: 'Compare', icon: GitCompare, prompt: 'Compare and contrast: ' },
    { label: 'MCQs (Try)', icon: HelpCircle, prompt: 'Give me 3 MCQs on: ' },
];

const SUGGESTED_TOPICS = [
    "What is the process of DNA replication?",
    "Explain the difference between mitosis and meiosis",
    "Which cells cause cancer? (Anchoring Test)",
    "What are autoimmune diseases? (Syllabus Test)",
];

export default function AdminAiTutorTestPage() {
    const [isStudentMode, setIsStudentMode] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hello! I am your AI Tutor. I support **Markdown**, $LaTeX$, tables, and can help you with MDCAT topics. Try asking me anything or use the quick actions below! 🎯' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
    const scrollEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollEndRef.current) {
            scrollEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, streamStatus]);

    const parseStreamStatus = (text: string): { status: StreamStatus | null; logId?: string; content: string } => {
        // Match status updates
        const statusMatch = text.match(/^data: ({.*?})\n\n/);
        if (statusMatch) {
            try {
                const data = JSON.parse(statusMatch[1]);
                if (data.status === 'log_id') {
                    return { status: null, logId: data.id, content: text.replace(statusMatch[0], '') };
                }
                return { status: data, content: text.replace(statusMatch[0], '') };
            } catch {
                return { status: null, content: text };
            }
        }
        return { status: null, content: text };
    };

    const handleSend = async (customMessage?: string) => {
        const messageToSend = customMessage || input.trim();
        if (!messageToSend) return;

        setLoading(true);
        setStreamStatus({ status: 'searching', message: '🔍 Searching knowledge base...' });
        setMessages(prev => [...prev, { role: 'user', content: messageToSend }]);
        setInput('');

        const history = messages.map(m => ({ role: m.role, content: m.content }));

        const endpoint = isStudentMode ? '/api/tutor' : '/api/admin/chat-tutor';
        const body = isStudentMode ? {
            message: messageToSend,
            history,
            streamStatus: true,
            userId: 'simulated-student',
            userName: 'Simulated Student',
            userRole: 'student'
        } : { message: messageToSend, history, streamStatus: true };

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.body) throw new Error("No response body");

            // Extract metadata from headers
            const metadata = {
                confidence: res.headers.get('X-Confidence') || undefined,
                subject: res.headers.get('X-Subject') || undefined,
                intent: res.headers.get('X-Intent') || undefined,
                sourcesCount: parseInt(res.headers.get('X-Sources-Count') || '0')
            };

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let assistantMsg = '';
            let currentLogId: string | undefined;
            let statusProcessed = false;

            setMessages(prev => [...prev, { role: 'assistant', content: '', metadata }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);

                // Check for status updates in stream
                const { status, logId, content } = parseStreamStatus(chunk);

                if (logId) {
                    currentLogId = logId;
                }

                if (status && !statusProcessed) {
                    setStreamStatus(status);
                    if (status.status === 'writing' || status.status === 'error') {
                        statusProcessed = true;
                    }
                }

                assistantMsg += content;

                setMessages(prev => {
                    const newArr = [...prev];
                    const lastMsg = newArr[newArr.length - 1];
                    lastMsg.content = assistantMsg;
                    if (currentLogId) lastMsg.logId = currentLogId;
                    return newArr;
                });
            }

            setStreamStatus(null);

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: '❌ Error: Failed to get response. Please try again.' }]);
            setStreamStatus(null);
        } finally {
            setLoading(false);
        }
    };

    const handleFeedback = async (index: number, feedback: 'helpful' | 'not_helpful') => {
        const msg = messages[index];
        if (!msg.logId) {
            toast.error("Cannot submit feedback: No Log ID found.");
            return;
        }

        // Optimistic update
        setMessages(prev => {
            const newArr = [...prev];
            newArr[index].feedback = feedback;
            return newArr;
        });

        try {
            await fetch('/api/tutor/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logId: msg.logId, feedback })
            });
            toast.success("Feedback submitted!");
        } catch (error) {
            console.error("Feedback failed:", error);
            toast.error("Failed to submit feedback");
        }
    };

    const handleQuickAction = (prompt: string) => {
        setInput(prompt);
    };

    const clearChat = () => {
        setMessages([
            { role: 'assistant', content: isStudentMode ? 'Student Mode Enabled! Try asking for MCQs to test restrictions. 🎓' : 'Chat cleared! How can I help you today? 🎯' }
        ]);
        setStreamStatus(null);
    };

    // Reset when mode changes
    const toggleMode = (checked: boolean) => {
        setIsStudentMode(checked);
        setMessages([
            { role: 'assistant', content: checked ? '🎓 **Student Simulation Mode Enabled**\n- Calls `/api/tutor`\n- Blocks MCQs\n- Tests Feedback System' : '🛠️ **Admin Console Mode**\n- Calls `/api/admin/chat-tutor`\n- No restrictions\n- Full debug info' }
        ]);
    };

    return (
        <div className="p-6 h-[calc(100vh-2rem)] flex flex-col">
            <Card className="flex flex-col flex-1 overflow-hidden">
                <CardHeader className="border-b bg-slate-50/50">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                                <Switch id="student-mode" checked={isStudentMode} onCheckedChange={toggleMode} />
                                <Label htmlFor="student-mode" className="flex items-center gap-2 cursor-pointer">
                                    {isStudentMode ? <User className="w-4 h-4 text-blue-600" /> : <UserCog className="w-4 h-4 text-slate-600" />}
                                    <span className={isStudentMode ? "font-bold text-blue-700" : "font-medium text-slate-700"}>
                                        {isStudentMode ? "Student Simulation" : "Admin Console"}
                                    </span>
                                </Label>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={clearChat}>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Clear
                        </Button>
                    </div>
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

                                        {/* Metadata badges for assistant messages */}
                                        {m.role === 'assistant' && m.metadata && !isStudentMode && (
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {m.metadata.confidence && (
                                                    <span className={`text-xs px-2 py-1 rounded-full ${m.metadata.confidence === 'high' ? 'bg-green-100 text-green-700' :
                                                        m.metadata.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-red-100 text-red-700'
                                                        }`}>
                                                        {m.metadata.confidence === 'high' ? '✅ High Confidence' :
                                                            m.metadata.confidence === 'medium' ? '⚠️ Medium Confidence' :
                                                                '❓ Low Confidence'}
                                                    </span>
                                                )}
                                                {m.metadata.subject && m.metadata.subject !== 'general' && (
                                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                                                        📚 {m.metadata.subject}
                                                    </span>
                                                )}
                                                {m.metadata.intent && (
                                                    <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 capitalize">
                                                        🎯 {m.metadata.intent}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                            className={`prose max-w-none break-words ${m.role === 'user' ? 'prose-invert text-white' : 'dark:prose-invert prose-slate'}`}
                                            components={{
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

                                        {/* Feedback buttons - Only in Student Mode */}
                                        {m.role === 'assistant' && m.content && !loading && isStudentMode && (
                                            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                                                <span className="text-xs text-slate-400 mr-2">Was this helpful?</span>
                                                <Button
                                                    variant={m.feedback === 'helpful' ? 'default' : 'ghost'}
                                                    size="sm"
                                                    className={`h-8 ${m.feedback === 'helpful' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                                                    onClick={() => handleFeedback(i, 'helpful')}
                                                >
                                                    <ThumbsUp className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant={m.feedback === 'not_helpful' ? 'default' : 'ghost'}
                                                    size="sm"
                                                    className={`h-8 ${m.feedback === 'not_helpful' ? 'bg-red-500 hover:bg-red-600' : ''}`}
                                                    onClick={() => handleFeedback(i, 'not_helpful')}
                                                >
                                                    <ThumbsDown className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Stream status indicator */}
                            {streamStatus && (
                                <div className="flex justify-start">
                                    <div className={`rounded-lg p-4 border animate-pulse ${streamStatus.status === 'error'
                                        ? 'bg-red-50 border-red-100'
                                        : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-100'
                                        }`}>
                                        <div className="flex items-center gap-2">
                                            {streamStatus.status !== 'error' && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
                                            <span className={`text-sm font-medium ${streamStatus.status === 'error' ? 'text-red-700' : 'text-blue-700'
                                                }`}>{streamStatus.message}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Suggested topics for empty state */}
                            {messages.length === 1 && (
                                <div className="mt-4">
                                    <p className="text-sm text-slate-500 mb-3">💡 Try asking about:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {SUGGESTED_TOPICS.map((topic, idx) => (
                                            <Button
                                                key={idx}
                                                variant="outline"
                                                size="sm"
                                                className="text-xs"
                                                onClick={() => handleSend(topic)}
                                            >
                                                {topic}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div ref={scrollEndRef} />
                        </div>
                    </div>

                    {/* Quick Actions Bar */}
                    <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {QUICK_ACTIONS.map((action, idx) => (
                                <Button
                                    key={idx}
                                    variant="ghost"
                                    size="sm"
                                    className="shrink-0 text-xs gap-1"
                                    onClick={() => handleQuickAction(action.prompt)}
                                >
                                    <action.icon className="w-3 h-3" />
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-200 bg-white">
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                            className="flex gap-2"
                        >
                            <Input
                                placeholder={isStudentMode ? "Ask as a student (try extracting MCQs...)" : "Ask a question from your books..."}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                disabled={loading}
                                className="flex-1"
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
