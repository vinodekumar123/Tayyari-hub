import { Student } from '@/types';
import { glassmorphism } from '@/lib/design-tokens';
import { Users, UserCheck, UserX, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StudentStatsProps {
    students: Student[];
    totalStudents: number;
}

export function StudentStats({ students, totalStudents }: StudentStatsProps) {
    const activeStudents = students.filter(s => s.plan !== 'free').length; // Assuming 'free' is default/inactive for paid plans
    const adminUsers = students.filter(s => s.admin).length;
    // This is a rough estimate based on loaded data, real stats might need separate query if accurate totals are needed globally
    // But for the view context it might be enough or we accept it's "visible" stats. 
    // Actually, usually dashboard stats come from a separate API or count query. 
    // For now, let's just use the props provided to show "Current View Stats" or we might want to pass in real totals if valid.

    // Let's assume we want to show stats for the *filtered* or *fetched* set, or maybe just generic visual header.

    return (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <Card className={`${glassmorphism.light} border-l-4 border-l-[#0066FF]`}>
                <CardContent className='p-4 flex items-center justify-between'>
                    <div>
                        <p className='text-sm text-muted-foreground font-medium'>Total Students</p>
                        <h3 className='text-2xl font-bold text-[#004AAD]'>{totalStudents}</h3>
                    </div>
                    <div className='h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center'>
                        <Users className='w-5 h-5 text-[#0066FF]' />
                    </div>
                </CardContent>
            </Card>

            {/* 
        We should probably just show some nice visual cards here contextually.
        If we don't have global stats, we can just show "Verified" etc if we had that data.
        For now I'll just keep it simple.
      */}

            <Card className={`${glassmorphism.light} border-l-4 border-l-green-500`}>
                <CardContent className='p-4 flex items-center justify-between'>
                    <div>
                        <p className='text-sm text-muted-foreground font-medium'>Enrolled Users</p>
                        <h3 className='text-2xl font-bold text-green-700'>
                            {students.filter(s => s.plan === 'premium').length}
                        </h3>
                    </div>
                    <div className='h-10 w-10 rounded-full bg-green-100 flex items-center justify-center'>
                        <UserCheck className='w-5 h-5 text-green-600' />
                    </div>
                </CardContent>
            </Card>

            <Card className={`${glassmorphism.light} border-l-4 border-l-purple-500`}>
                <CardContent className='p-4 flex items-center justify-between'>
                    <div>
                        <p className='text-sm text-muted-foreground font-medium'>Admins</p>
                        <h3 className='text-2xl font-bold text-purple-700'>
                            {adminUsers}
                        </h3>
                    </div>
                    <div className='h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center'>
                        <ShieldCheck className='w-5 h-5 text-purple-600' />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
