import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    User,
    Mail,
    Phone,
    BookOpen,
    MoreVertical,
    Edit,
    Trash2,
    History,
    CreditCard,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    UserCheck,
    UserX,
    Lock,
    FileText
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Student } from '@/types';
import Image from 'next/image';
import { glassmorphism, animations } from '@/lib/design-tokens';
import { format } from 'date-fns';

interface StudentTableProps {
    students: Student[];
    selectedIds: Set<string>;
    isAllSelected: boolean;
    onSelectAll: () => void;
    onSelectOne: (id: string) => void;
    sortField: string;
    sortDirection: 'asc' | 'desc';
    onSort: (field: any) => void;
    onEdit: (student: Student) => void;
    onEnroll: (student: Student) => void;
    onHistory: (student: Student) => void;
    onDelete: (student: Student) => void;
    onPasswordReset: (student: Student) => void;
    onToggleStatus: (student: Student) => void;
    onViewResults: (student: Student) => void;
    loading: boolean;
}

export function StudentTable({
    students,
    selectedIds,
    isAllSelected,
    onSelectAll,
    onSelectOne,
    sortField,
    sortDirection,
    onSort,
    onEdit,
    onEnroll,
    onHistory,
    onDelete,
    onPasswordReset,
    onToggleStatus,
    onViewResults,
    loading
}: StudentTableProps) {

    const formatDate = (date: any) => {
        if (!date) return 'N/A';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            return format(d, 'MMM dd, yyyy');
        } catch (e) {
            return 'Invalid Date';
        }
    };

    return (
        <div className={`${glassmorphism.light} border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-xl overflow-hidden rounded-xl`}>
            <div className='overflow-x-auto'>
                <Table>
                    <TableHeader>
                        <TableRow className='bg-muted/50'>
                            <TableHead className='w-12'>
                                <Checkbox
                                    checked={isAllSelected}
                                    onCheckedChange={onSelectAll}
                                />
                            </TableHead>
                            <TableHead>
                                <button
                                    onClick={() => onSort('fullName')}
                                    className='flex items-center gap-2 hover:text-foreground transition-colors font-semibold'
                                >
                                    Student
                                    {sortField === 'fullName' ? (
                                        sortDirection === 'asc' ? <ArrowUp className='w-4 h-4 text-[#0066FF]' /> : <ArrowDown className='w-4 h-4 text-[#0066FF]' />
                                    ) : <ArrowUpDown className='w-4 h-4 opacity-30' />}
                                </button>
                            </TableHead>
                            <TableHead>
                                <button
                                    onClick={() => onSort('email')}
                                    className='flex items-center gap-2 hover:text-foreground transition-colors font-semibold'
                                >
                                    Contact
                                    {sortField === 'email' ? (
                                        sortDirection === 'asc' ? <ArrowUp className='w-4 h-4 text-[#0066FF]' /> : <ArrowDown className='w-4 h-4 text-[#0066FF]' />
                                    ) : <ArrowUpDown className='w-4 h-4 opacity-30' />}
                                </button>
                            </TableHead>
                            <TableHead>
                                <button
                                    onClick={() => onSort('course')}
                                    className='flex items-center gap-2 hover:text-foreground transition-colors font-semibold'
                                >
                                    Course
                                    {sortField === 'course' ? (
                                        sortDirection === 'asc' ? <ArrowUp className='w-4 h-4 text-[#0066FF]' /> : <ArrowDown className='w-4 h-4 text-[#0066FF]' />
                                    ) : <ArrowUpDown className='w-4 h-4 opacity-30' />}
                                </button>
                            </TableHead>
                            <TableHead>
                                <button
                                    onClick={() => onSort('plan')}
                                    className='flex items-center gap-2 hover:text-foreground transition-colors font-semibold'
                                >
                                    Plan
                                    {sortField === 'plan' ? (
                                        sortDirection === 'asc' ? <ArrowUp className='w-4 h-4 text-[#0066FF]' /> : <ArrowDown className='w-4 h-4 text-[#0066FF]' />
                                    ) : <ArrowUpDown className='w-4 h-4 opacity-30' />}
                                </button>
                            </TableHead>
                            <TableHead>
                                Joined
                            </TableHead>
                            <TableHead className='text-right'>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {students.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className='text-center py-16'>
                                    <User className='w-16 h-16 mx-auto text-muted-foreground mb-4' />
                                    <p className='text-xl font-semibold text-muted-foreground'>No students found</p>
                                    <p className='text-sm text-muted-foreground mt-2'>Try adjusting your filters</p>
                                </TableCell >
                            </TableRow >
                        ) : (
                            students.map((student) => (
                                <TableRow
                                    key={student.id}
                                    className={`${animations.smooth} hover:bg-muted/50 ${selectedIds.has(student.id) ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}
                                >
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.has(student.id)}
                                            onCheckedChange={() => onSelectOne(student.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className='flex items-center gap-3'>
                                            <div className='h-10 w-10 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm flex-shrink-0 relative'>
                                                <Image
                                                    src={student.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.fullName || 'User')}&background=random`}
                                                    alt={student.fullName || 'User'}
                                                    className='object-cover'
                                                    width={40}
                                                    height={40}
                                                    unoptimized={true}
                                                />
                                            </div>
                                            <div>
                                                <p className='font-semibold text-foreground flex items-center gap-2'>
                                                    {student.fullName || 'Unknown'}
                                                    {student.disabled && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">Suspended</Badge>}
                                                </p>
                                                <p className='text-xs text-muted-foreground'>{student.district || 'No location'}</p>
                                            </div>
                                        </div >
                                    </TableCell >
                                    <TableCell>
                                        <div className='space-y-1'>
                                            <div className='flex items-center gap-2 text-sm'>
                                                <Mail className='w-3 h-3 text-muted-foreground' />
                                                <span className='truncate max-w-[200px]'>{student.email}</span>
                                            </div >
                                            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                                                <Phone className='w-3 h-3' />
                                                <span>{student.phone || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className='flex items-center gap-2'>
                                            <BookOpen className='w-4 h-4 text-blue-500' />
                                            <span className='font-medium'>{student.course || 'None'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={student.plan === 'premium' ? 'default' : 'secondary'}
                                            className={student.plan === 'premium'
                                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                                                : ''}
                                        >
                                            {student.plan === 'premium' ? 'Premium' : 'Free'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {formatDate(student.createdAt)}
                                        </span>
                                    </TableCell>
                                    <TableCell className='text-right'>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant='ghost' size='icon'>
                                                    <MoreVertical className='w-4 h-4' />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align='end'>
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => onEdit(student)}>
                                                    <Edit className='w-4 h-4 mr-2' />
                                                    Edit Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onEnroll(student)}>
                                                    <CreditCard className='w-4 h-4 mr-2' />
                                                    Enroll in Series
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onHistory(student)}>
                                                    <History className='w-4 h-4 mr-2' />
                                                    View History
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onViewResults(student)}>
                                                    <FileText className='w-4 h-4 mr-2' />
                                                    View Results
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onPasswordReset(student)}>
                                                    <Lock className='w-4 h-4 mr-2' />
                                                    Reset Password
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onToggleStatus(student)}>
                                                    {student.disabled ? <UserCheck className='w-4 h-4 mr-2 text-green-600' /> : <UserX className='w-4 h-4 mr-2 text-orange-600' />}
                                                    {student.disabled ? 'Activate Account' : 'Suspend Account'}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => onDelete(student)}
                                                    className='text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20'
                                                >
                                                    <Trash2 className='w-4 h-4 mr-2' />
                                                    Delete Student
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
