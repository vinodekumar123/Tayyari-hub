import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Skeleton for stats cards in dashboard
export function StatsCardSkeleton() {
    return (
        <Card className="border-none shadow-lg">
            <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-10 w-24 mb-4" />
                <Skeleton className="h-3 w-full" />
            </CardContent>
        </Card>
    );
}

// Skeleton for chart cards
export function ChartSkeleton({ height = "350px" }: { height?: string }) {
    return (
        <Card className="border-none shadow-lg">
            <CardHeader className="border-b p-6">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-6 w-48" />
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <Skeleton className="w-full" style={{ height }} />
            </CardContent>
        </Card>
    );
}

// Skeleton for table rows
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
    return (
        <div className="flex items-center gap-4 p-4 border-b">
            {Array.from({ length: columns }).map((_, i) => (
                <Skeleton key={i} className="h-6 flex-1" />
            ))}
        </div>
    );
}

// Skeleton for entire table
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
    return (
        <Card className="border-none shadow-lg">
            <CardHeader className="border-b p-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {Array.from({ length: rows }).map((_, i) => (
                    <TableRowSkeleton key={i} columns={columns} />
                ))}
            </CardContent>
        </Card>
    );
}

// Skeleton for full dashboard
export function DashboardSkeleton() {
    return (
        <div className="p-4 sm:p-6 md:p-8 space-y-8">
            {/* Header Skeleton */}
            <div className="bg-card/60 backdrop-blur-xl p-8 rounded-3xl border">
                <Skeleton className="h-12 w-96 mb-4" />
                <Skeleton className="h-6 w-64" />
            </div>

            {/* Stats Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <StatsCardSkeleton key={i} />
                ))}
            </div>

            {/* Charts Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <ChartSkeleton />
                </div>
                <ChartSkeleton />
            </div>
        </div>
    );
}

// Skeleton for list items
export function ListItemSkeleton() {
    return (
        <div className="flex items-center gap-4 p-4 border-b">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
    );
}

// Skeleton for form
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
    return (
        <div className="space-y-6">
            {Array.from({ length: fields }).map((_, i) => (
                <div key={i} className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                </div>
            ))}
            <div className="flex gap-3 justify-end">
                <Skeleton className="h-12 w-24 rounded-lg" />
                <Skeleton className="h-12 w-32 rounded-lg" />
            </div>
        </div>
    );
}
