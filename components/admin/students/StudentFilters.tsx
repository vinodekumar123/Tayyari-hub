import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens';
import { Course } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface StudentFiltersProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    filterType: string;
    onFilterTypeChange: (value: string) => void;
    courseFilter: string;
    onCourseFilterChange: (value: string) => void;
    courses: Course[];
    itemsPerPage: number;
    onItemsPerPageChange: (value: number) => void;
    onClearFilters: () => void;
}

export function StudentFilters({
    searchTerm,
    onSearchChange,
    filterType,
    onFilterTypeChange,
    courseFilter,
    onCourseFilterChange,
    courses,
    itemsPerPage,
    onItemsPerPageChange,
    onClearFilters
}: StudentFiltersProps) {
    return (
        <Card className={`${glassmorphism.light} border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-xl`}>
            <CardContent className='p-6'>
                <div className='flex flex-col md:flex-row gap-4'>
                    <div className='relative flex-1'>
                        <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground' />
                        <Input
                            placeholder='Search by name, email, phone...'
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className='pl-10 bg-background/50 border-[#004AAD]/20 focus:border-[#0066FF]'
                        />
                    </div>

                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant='outline' className='gap-2'>
                                <Filter className='w-4 h-4' />
                                Filters
                                {(filterType !== 'all' || courseFilter !== 'all') && (
                                    <Badge variant='secondary' className='ml-2'>Active</Badge>
                                )}
                            </Button>
                        </SheetTrigger>
                        <SheetContent>
                            <SheetHeader>
                                <SheetTitle>Filter Students</SheetTitle>
                                <SheetDescription>Apply filters to narrow down the student list</SheetDescription>
                            </SheetHeader>
                            <div className='space-y-4 mt-6'>
                                <div className='space-y-2'>
                                    <Label>Student Type</Label>
                                    <Select value={filterType} onValueChange={onFilterTypeChange}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value='all'>All Students</SelectItem>
                                            <SelectItem value='premium'>Premium</SelectItem>
                                            <SelectItem value='free'>Free</SelectItem>
                                            <SelectItem value='admin'>Admins</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className='space-y-2'>
                                    <Label>Course</Label>
                                    <Select value={courseFilter} onValueChange={onCourseFilterChange}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value='all'>All Courses</SelectItem>
                                            {courses.map(course => (
                                                <SelectItem key={course.id} value={course.name}>{course.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className='space-y-2'>
                                    <Label>Items Per Page</Label>
                                    <Select value={itemsPerPage.toString()} onValueChange={(v) => onItemsPerPageChange(Number(v))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value='10'>10</SelectItem>
                                            <SelectItem value='20'>20</SelectItem>
                                            <SelectItem value='50'>50</SelectItem>
                                            <SelectItem value='100'>100</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    variant='outline'
                                    className='w-full'
                                    onClick={onClearFilters}
                                >
                                    Clear All Filters
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </CardContent>
        </Card>
    );
}
