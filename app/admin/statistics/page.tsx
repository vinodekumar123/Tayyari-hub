'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/app/firebase';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { EnrollmentRecord, Series, Course } from '@/types';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts';
import {
    Calendar as CalendarIcon,
    TrendingUp,
    Users,
    CreditCard,
    Activity,
    Filter,
    Download,
    AlertCircle
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { glassmorphism, brandColors } from '@/lib/design-tokens';
import { Input } from '@/components/ui/input';

// --- Types ---
interface DateRange {
    from: Date | undefined;
    to: Date | undefined;
}

interface AnalyticsData {
    totalRevenue: number;
    totalEnrollments: number;
    activeEnrollments: number;
    uniqueStudents: number;
    revenueBySeries: { name: string; revenue: number; count: number }[];
    revenueByCourse: { name: string; revenue: number; count: number }[];
    dailyRevenue: { date: string; revenue: number; enrollments: number }[];
}

import { useUserStore } from '@/stores/useUserStore';
import { useRouter } from 'next/navigation';

export default function StatisticsPage() {
    const router = useRouter();
    const { user, isSuperAdmin, isLoading: isUserLoading } = useUserStore();

    // State
    const [dateRangeType, setDateRangeType] = useState<string>('30days');
    const [customRange, setCustomRange] = useState<DateRange>({ from: undefined, to: undefined });
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState<{
        enrollments: EnrollmentRecord[];
        series: Map<string, Series>;
        courses: Map<string, Course>;
    }>({ enrollments: [], series: new Map(), courses: new Map() });

    // Access Control
    useEffect(() => {
        if (!isUserLoading && !isSuperAdmin()) {
            router.push('/dashboard/admin'); // Redirect to main dashboard
        }
    }, [isUserLoading, isSuperAdmin, router]);

    // Compute Active Date Range
    const activeRange = useMemo(() => {
        const today = new Date();
        let from = startOfDay(today);
        let to = endOfDay(today);

        switch (dateRangeType) {
            case 'today':
                break;
            case 'yesterday':
                from = startOfDay(subDays(today, 1));
                to = endOfDay(subDays(today, 1));
                break;
            case '7days':
                from = startOfDay(subDays(today, 7));
                break;
            case '30days':
                from = startOfDay(subDays(today, 30));
                break;
            case 'thisMonth':
                from = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
                break;
            case 'lastMonth':
                from = startOfDay(new Date(today.getFullYear(), today.getMonth() - 1, 1));
                to = endOfDay(new Date(today.getFullYear(), today.getMonth(), 0));
                break;
            case 'custom':
                if (customRange.from && customRange.to) {
                    from = startOfDay(customRange.from);
                    to = endOfDay(customRange.to);
                }
                break;
        }
        return { from, to };
    }, [dateRangeType, customRange]);

    // Data Fetching
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Static Definitions (Series & Courses)
                // We fetch ALL series and courses because they are metadata and relatively small.
                const [seriesSnap, coursesSnap] = await Promise.all([
                    getDocs(collection(db, 'series')),
                    getDocs(collection(db, 'courses'))
                ]);

                const seriesMap = new Map<string, Series>();
                seriesSnap.docs.forEach(d => seriesMap.set(d.id, { id: d.id, ...d.data() } as Series));

                const coursesMap = new Map<string, Course>();
                coursesSnap.docs.forEach(d => coursesMap.set(d.id, { id: d.id, ...d.data() } as Course));

                // 2. Fetch Enrollments based on Date Range
                // Firestore queries require an index for complex filtering, so for now we'll fetch wider ranges 
                // or just fetch all active if dataset is small, but let's try to filter by paymentDate.
                // paymentDate is string ISO, so string comparison works (mostly).

                let q = query(collection(db, 'enrollments'), orderBy('paymentDate', 'desc'));

                // Optimisation: If > 30 days, maybe limit? For now, fetch all then filter in memory 
                // to insure accuracy with "Total" vs "Filtered" metrics if needed, 
                // but strict requirement is "Filtered Statistics". 
                // Let's rely on standard query.

                const enrollSnap = await getDocs(q);
                const enrollments = enrollSnap.docs.map(d => ({ id: d.id, ...d.data() } as EnrollmentRecord));

                setRawData({
                    enrollments,
                    series: seriesMap,
                    courses: coursesMap
                });

            } catch (error) {
                console.error("Error fetching analytics data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []); // Reload only on manual refresh for now to avoid rapid fire reads, or we can add dependency if "Go" button used.

    // Metrics Calculation (Memoized)
    const stats = useMemo<AnalyticsData>(() => {
        const { enrollments, series, courses } = rawData;
        const { from, to } = activeRange;

        // Filter by Date
        const filtered = enrollments.filter(rec => {
            if (!rec.paymentDate) return false;
            const date = new Date(rec.paymentDate);
            return isWithinInterval(date, { start: from, end: to });
        });

        const metrics: AnalyticsData = {
            totalRevenue: 0,
            totalEnrollments: filtered.length,
            activeEnrollments: 0,
            uniqueStudents: 0,
            revenueBySeries: [],
            revenueByCourse: [],
            dailyRevenue: []
        };

        const seriesStats = new Map<string, { revenue: number; count: number }>();
        const courseStats = new Map<string, { revenue: number; count: number }>();
        const dailyStats = new Map<string, { revenue: number; count: number }>();
        const studentSet = new Set<string>();

        filtered.forEach(rec => {
            // Basic Sums (Status Check: only count valid enrollments for revenue)
            // Assuming 'active' and 'expired' are valid "Paid" states. 'cancelled'/'refunded' are not.
            const isValid = rec.status !== 'cancelled' && rec.status !== 'refunded';

            if (isValid) {
                metrics.totalRevenue += rec.price || 0;

                // Series Aggregation
                const sName = rec.seriesName || 'Unknown Series';
                const sCurrent = seriesStats.get(sName) || { revenue: 0, count: 0 };
                seriesStats.set(sName, { revenue: sCurrent.revenue + (rec.price || 0), count: sCurrent.count + 1 });

                // Course Aggregation (Join via Series)
                const seriesDef = series.get(rec.seriesId);
                const courseId = seriesDef?.courseId;
                const courseDef = courseId ? courses.get(courseId) : null;
                const cName = courseDef?.name || 'Unknown Course';

                const cCurrent = courseStats.get(cName) || { revenue: 0, count: 0 };
                courseStats.set(cName, { revenue: cCurrent.revenue + (rec.price || 0), count: cCurrent.count + 1 });

                // Daily Aggregation
                const dayKey = format(new Date(rec.paymentDate), 'yyyy-MM-dd');
                const dCurrent = dailyStats.get(dayKey) || { revenue: 0, count: 0 };
                dailyStats.set(dayKey, { revenue: dCurrent.revenue + (rec.price || 0), count: dCurrent.count + 1 });
            }

            if (rec.status === 'active') metrics.activeEnrollments++;
            if (rec.studentId) studentSet.add(rec.studentId);
        });

        metrics.uniqueStudents = studentSet.size;

        // Convert Maps to Arrays and Sort
        metrics.revenueBySeries = Array.from(seriesStats.entries())
            .map(([name, val]) => ({ name, ...val }))
            .sort((a, b) => b.revenue - a.revenue);

        metrics.revenueByCourse = Array.from(courseStats.entries())
            .map(([name, val]) => ({ name, ...val }))
            .sort((a, b) => b.revenue - a.revenue);

        metrics.dailyRevenue = Array.from(dailyStats.entries())
            .map(([date, val]) => ({ date, revenue: val.revenue, enrollments: val.count }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return metrics;
    }, [rawData, activeRange]);


    if (loading) {
        return <div className="p-8 flex justify-center text-muted-foreground">Loading Analytics...</div>;
    }

    return (
        <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] to-[#0066FF] dark:from-[#338EF7] dark:to-[#00B4D8]">
                        Analytics Dashboard
                    </h1>
                    <p className="text-muted-foreground font-medium">Financial & Enrollment Insights</p>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
                    <CalendarIcon className="w-5 h-5 text-muted-foreground" />
                    <Select value={dateRangeType} onValueChange={setDateRangeType}>
                        <SelectTrigger className="w-[180px] border-none bg-transparent focus:ring-0">
                            <SelectValue placeholder="Select Range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="yesterday">Yesterday</SelectItem>
                            <SelectItem value="7days">Last 7 Days</SelectItem>
                            <SelectItem value="30days">Last 30 Days</SelectItem>
                            <SelectItem value="thisMonth">This Month</SelectItem>
                            <SelectItem value="lastMonth">Last Month</SelectItem>
                            <SelectItem value="custom">Custom Range</SelectItem>
                        </SelectContent>
                    </Select>
                    {dateRangeType === 'custom' && (
                        <div className="flex gap-2">
                            <Input
                                type="date"
                                className="w-[140px]"
                                onChange={(e) => setCustomRange(p => ({ ...p, from: e.target.valueAsDate || undefined }))}
                            />
                            <span className="self-center">-</span>
                            <Input
                                type="date"
                                className="w-[140px]"
                                onChange={(e) => setCustomRange(p => ({ ...p, to: e.target.valueAsDate || undefined }))}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Total Revenue"
                    value={`PKR ${stats.totalRevenue.toLocaleString()}`}
                    icon={<CreditCard className="w-5 h-5 text-green-600" />}
                    gradient="from-green-500/10 to-green-500/5"
                    borderColor="border-green-200 dark:border-green-900"
                />
                <StatsCard
                    title="Total Enrollments"
                    value={stats.totalEnrollments.toString()}
                    icon={<Activity className="w-5 h-5 text-blue-600" />}
                    gradient="from-blue-500/10 to-blue-500/5"
                    borderColor="border-blue-200 dark:border-blue-900"
                />
                <StatsCard
                    title="Unique Students"
                    value={stats.uniqueStudents.toString()}
                    icon={<Users className="w-5 h-5 text-purple-600" />}
                    gradient="from-purple-500/10 to-purple-500/5"
                    borderColor="border-purple-200 dark:border-purple-900"
                />
                <StatsCard
                    title="Active Now"
                    value={stats.activeEnrollments.toString()}
                    icon={<TrendingUp className="w-5 h-5 text-orange-600" />}
                    gradient="from-orange-500/10 to-orange-500/5"
                    borderColor="border-orange-200 dark:border-orange-900"
                />
            </div>

            {/* Main Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Chart */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                    <CardHeader>
                        <CardTitle>Revenue Trend</CardTitle>
                        <CardDescription>Daily financial performance over selected period.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.dailyRevenue}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(str) => format(parseISO(str), 'dd MMM')}
                                    fontSize={12}
                                />
                                <YAxis fontSize={12} />
                                <Tooltip
                                    formatter={(val: number) => [`PKR ${val.toLocaleString()}`, 'Revenue']}
                                    labelFormatter={(label) => format(parseISO(label), 'dd MMM yyyy')}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Line type="monotone" dataKey="revenue" stroke="#004AAD" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Series Chart */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                    <CardHeader>
                        <CardTitle>Top Performing Series</CardTitle>
                        <CardDescription>Revenue distribution by series.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.revenueBySeries.slice(0, 5)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis type="number" fontSize={12} />
                                <YAxis dataKey="name" type="category" width={120} fontSize={12} />
                                <Tooltip
                                    formatter={(val: number) => [`PKR ${val.toLocaleString()}`, 'Revenue']}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="revenue" fill="#00B4D8" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Series Breakdown */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                    <CardHeader>
                        <CardTitle>Series Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-auto max-h-[400px]">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                                    <tr className="border-b text-slate-500">
                                        <th className="text-left py-2 font-medium">Series Name</th>
                                        <th className="text-right py-2 font-medium">Enrollments</th>
                                        <th className="text-right py-2 font-medium">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.revenueBySeries.map((s, i) => (
                                        <tr key={i} className="border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="py-3 font-medium">{s.name}</td>
                                            <td className="text-right py-3 text-slate-500">{s.count}</td>
                                            <td className="text-right py-3 font-mono">PKR {s.revenue.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Course Breakdown */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
                    <CardHeader>
                        <CardTitle>Course Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-auto max-h-[400px]">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                                    <tr className="border-b text-slate-500">
                                        <th className="text-left py-2 font-medium">Course Name</th>
                                        <th className="text-right py-2 font-medium">Enrollments</th>
                                        <th className="text-right py-2 font-medium">Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.revenueByCourse.map((c, i) => (
                                        <tr key={i} className="border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="py-3 font-medium">{c.name}</td>
                                            <td className="text-right py-3 text-slate-500">{c.count}</td>
                                            <td className="text-right py-3 font-mono">PKR {c.revenue.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}

function StatsCard({ title, value, icon, gradient, borderColor }: { title: string, value: string, icon: React.ReactNode, gradient: string, borderColor: string }) {
    return (
        <Card className={`border ${borderColor} bg-gradient-to-br ${gradient} shadow-md`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-foreground">{value}</div>
            </CardContent>
        </Card>
    );
}
