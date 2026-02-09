'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
    Loader2, BarChart3, Clock, MessageSquare, Search,
    TrendingUp, Database, Zap, Brain, RefreshCw
} from 'lucide-react';
import {
    getAITutorAnalytics,
    testVectorSearch,
    getRecentConversations,
    TutorAnalytics
} from '@/app/actions/aiTutorAnalytics';
import Link from 'next/link';

export default function AITutorAnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState<TutorAnalytics | null>(null);
    const [conversations, setConversations] = useState<any[]>([]);
    const [testQuery, setTestQuery] = useState('');
    const [testResults, setTestResults] = useState<any[]>([]);
    const [testLoading, setTestLoading] = useState(false);
    const [days, setDays] = useState(7);

    useEffect(() => {
        loadData();
    }, [days]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [analyticsRes, conversationsRes] = await Promise.all([
                getAITutorAnalytics(days),
                getRecentConversations(50)
            ]);

            if (analyticsRes.success) {
                setAnalytics(analyticsRes.data!);
            }
            if (conversationsRes.success) {
                setConversations(conversationsRes.conversations!);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    const handleTestSearch = async () => {
        if (!testQuery.trim()) return;

        setTestLoading(true);
        try {
            const res = await testVectorSearch(testQuery);
            if (res.success) {
                setTestResults(res.results!);
                toast.success(`Found ${res.results!.length} results`);
            } else {
                toast.error(res.error);
            }
        } catch (error) {
            toast.error('Search test failed');
        } finally {
            setTestLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <BarChart3 className="w-8 h-8" />
                        AI Tutor Analytics
                    </h1>
                    <p className="text-slate-500">Monitor usage, performance, and knowledge gaps</p>
                </div>
                <div className="flex gap-2">
                    <select
                        className="border rounded px-3 py-2 text-sm"
                        value={days}
                        onChange={e => setDays(Number(e.target.value))}
                    >
                        <option value={1}>Last 24 hours</option>
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                    </select>
                    <Button variant="outline" onClick={loadData}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Link href="/admin/ai-tutor-test">
                        <Button>
                            <Brain className="w-4 h-4 mr-2" />
                            Test Console
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            {analytics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-blue-500" />
                                <div>
                                    <div className="text-2xl font-bold">{analytics.totalQueries}</div>
                                    <div className="text-sm text-slate-500">Total Queries</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2">
                                <Zap className="w-5 h-5 text-amber-500" />
                                <div>
                                    <div className="text-2xl font-bold">{analytics.cachedResponses}</div>
                                    <div className="text-sm text-slate-500">Cache Hits</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-green-500" />
                                <div>
                                    <div className="text-2xl font-bold">{analytics.avgResponseTimeMs}ms</div>
                                    <div className="text-sm text-slate-500">Avg Response Time</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-purple-500" />
                                <div>
                                    <div className="text-2xl font-bold">
                                        {analytics.totalQueries > 0
                                            ? Math.round((analytics.cachedResponses / analytics.totalQueries) * 100)
                                            : 0}%
                                    </div>
                                    <div className="text-sm text-slate-500">Cache Rate</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Tabs defaultValue="queries">
                <TabsList>
                    <TabsTrigger value="queries">Top Queries</TabsTrigger>
                    <TabsTrigger value="subjects">By Subject</TabsTrigger>
                    <TabsTrigger value="conversations">Recent Conversations</TabsTrigger>
                    <TabsTrigger value="test">Vector Search Test</TabsTrigger>
                </TabsList>

                {/* Top Queries */}
                <TabsContent value="queries">
                    <Card>
                        <CardHeader>
                            <CardTitle>Most Common Questions</CardTitle>
                            <CardDescription>Identify popular topics and potential areas for content improvement</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {analytics?.topQueries.length === 0 ? (
                                <p className="text-slate-500 text-center py-8">No queries logged yet</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Query</TableHead>
                                            <TableHead className="text-right">Count</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {analytics?.topQueries.map((q, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium">{q.query}</TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant="secondary">{q.count}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* By Subject */}
                <TabsContent value="subjects">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Queries by Subject</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {Object.entries(analytics?.queriesBySubject || {}).map(([subject, count]) => (
                                        <div key={subject} className="flex justify-between items-center">
                                            <span className="font-medium">{subject}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-32 bg-slate-100 rounded-full h-2">
                                                    <div
                                                        className="bg-blue-500 h-2 rounded-full"
                                                        style={{
                                                            width: `${(count / (analytics?.totalQueries || 1)) * 100}%`
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-sm text-slate-500 w-10">{count}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Queries by Intent</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {Object.entries(analytics?.queriesByIntent || {}).map(([intent, count]) => (
                                        <div key={intent} className="flex justify-between items-center">
                                            <span className="font-medium capitalize">{intent}</span>
                                            <Badge variant="outline">{count}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Recent Conversations */}
                <TabsContent value="conversations">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent AI Conversations</CardTitle>
                            <CardDescription>Review queries and responses for quality assurance</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {conversations.length === 0 ? (
                                <p className="text-slate-500 text-center py-8">No conversations logged yet</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Query</TableHead>
                                            <TableHead>Subject</TableHead>
                                            <TableHead>Intent</TableHead>
                                            <TableHead>Response Time</TableHead>
                                            <TableHead>Cached</TableHead>
                                            <TableHead>Time</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {conversations.map(c => (
                                            <TableRow key={c.id}>
                                                <TableCell className="max-w-[200px] truncate font-medium">
                                                    {c.query}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{c.subject || 'general'}</Badge>
                                                </TableCell>
                                                <TableCell className="capitalize">{c.intent}</TableCell>
                                                <TableCell>{c.responseTimeMs}ms</TableCell>
                                                <TableCell>
                                                    {c.wasFromCache ? (
                                                        <Badge className="bg-green-100 text-green-700">Yes</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">No</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-slate-500 text-sm">
                                                    {new Date(c.timestamp).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Vector Search Test */}
                <TabsContent value="test">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="w-5 h-5" />
                                Knowledge Base Search Test
                            </CardTitle>
                            <CardDescription>
                                Test what documents would be retrieved for a given query
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Enter a test query (e.g., 'What is DNA replication?')"
                                    value={testQuery}
                                    onChange={e => setTestQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleTestSearch()}
                                />
                                <Button onClick={handleTestSearch} disabled={testLoading || !testQuery.trim()}>
                                    {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                </Button>
                            </div>

                            {testResults.length > 0 && (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>#</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Subject</TableHead>
                                            <TableHead>Book</TableHead>
                                            <TableHead>Chapter</TableHead>
                                            <TableHead>Content Preview</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {testResults.map((r, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-bold">{i + 1}</TableCell>
                                                <TableCell>
                                                    <Badge variant={r.type === 'syllabus' ? 'default' : 'secondary'}>
                                                        {r.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{r.subject}</TableCell>
                                                <TableCell>{r.bookName}</TableCell>
                                                <TableCell>{r.chapter}</TableCell>
                                                <TableCell className="max-w-[200px] truncate text-sm text-slate-500">
                                                    {r.contentPreview}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
