'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Plus, Minus, Play, Settings, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CreateMockTest() {
  const router = useRouter();
  const [testConfig, setTestConfig] = useState({
    title: '',
    course: '',
    subjects: [] as string[],
    chapters: [] as string[],
    totalQuestions: 30,
    duration: 45,
    difficulty: 'mixed',
    questionTypes: ['mcq'],
    shuffleQuestions: true,
    shuffleOptions: true
  });

  const courses = [
    { id: 'mdcat', name: 'MDCAT', subjects: ['Biology', 'Chemistry', 'Physics'] },
    { id: 'ecat', name: 'ECAT', subjects: ['Mathematics', 'Physics', 'Chemistry'] },
    { id: 'lat', name: 'LAT', subjects: ['English', 'General Knowledge', 'Current Affairs'] }
  ];

  const chapters = {
    'Biology': ['Cell Structure', 'Genetics', 'Evolution', 'Ecology', 'Human Biology'],
    'Chemistry': ['Atomic Structure', 'Chemical Bonding', 'Organic Chemistry', 'Inorganic Chemistry'],
    'Physics': ['Mechanics', 'Thermodynamics', 'Electromagnetism', 'Modern Physics'],
    'Mathematics': ['Algebra', 'Calculus', 'Trigonometry', 'Statistics', 'Geometry']
  };

  const difficulties = [
    { id: 'easy', name: 'Easy', description: 'Basic level questions' },
    { id: 'medium', name: 'Medium', description: 'Intermediate level questions' },
    { id: 'hard', name: 'Hard', description: 'Advanced level questions' },
    { id: 'mixed', name: 'Mixed', description: 'Questions from all difficulty levels' }
  ];

  const handleSubjectChange = (subject: string, checked: boolean) => {
    setTestConfig(prev => ({
      ...prev,
      subjects: checked 
        ? [...prev.subjects, subject]
        : prev.subjects.filter(s => s !== subject),
      chapters: checked 
        ? prev.chapters
        : prev.chapters.filter(c => !chapters[subject as keyof typeof chapters]?.includes(c))
    }));
  };

  const handleChapterChange = (chapter: string, checked: boolean) => {
    setTestConfig(prev => ({
      ...prev,
      chapters: checked 
        ? [...prev.chapters, chapter]
        : prev.chapters.filter(c => c !== chapter)
    }));
  };

  const getAvailableChapters = () => {
    return testConfig.subjects.flatMap(subject => 
      chapters[subject as keyof typeof chapters] || []
    );
  };

  const handleCreateTest = () => {
    // Validate configuration
    if (!testConfig.title || !testConfig.course || testConfig.subjects.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    // Create mock test and redirect to quiz
    const mockTestId = Date.now().toString();
    localStorage.setItem(`mock-test-${mockTestId}`, JSON.stringify(testConfig));
    router.push(`/quiz/${mockTestId}`);
  };

  const selectedCourse = courses.find(c => c.id === testConfig.course);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Create Mock Test</span>
              </div>
            </div>
            
            <Button variant="outline" onClick={() => router.back()}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Test Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Test Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Test Title *</Label>
                  <Input
                    id="title"
                    placeholder="Enter test title"
                    value={testConfig.title}
                    onChange={(e) => setTestConfig(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="course">Course *</Label>
                  <Select 
                    value={testConfig.course} 
                    onValueChange={(value) => setTestConfig(prev => ({ 
                      ...prev, 
                      course: value, 
                      subjects: [],
                      chapters: []
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map(course => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="questions">Total Questions</Label>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTestConfig(prev => ({ 
                        ...prev, 
                        totalQuestions: Math.max(10, prev.totalQuestions - 5) 
                      }))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      id="questions"
                      type="number"
                      min="10"
                      max="100"
                      value={testConfig.totalQuestions}
                      onChange={(e) => setTestConfig(prev => ({ 
                        ...prev, 
                        totalQuestions: parseInt(e.target.value) || 30 
                      }))}
                      className="text-center"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTestConfig(prev => ({ 
                        ...prev, 
                        totalQuestions: Math.min(100, prev.totalQuestions + 5) 
                      }))}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="15"
                    max="180"
                    value={testConfig.duration}
                    onChange={(e) => setTestConfig(prev => ({ 
                      ...prev, 
                      duration: parseInt(e.target.value) || 45 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <Select 
                    value={testConfig.difficulty} 
                    onValueChange={(value) => setTestConfig(prev => ({ ...prev, difficulty: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {difficulties.map(difficulty => (
                        <SelectItem key={difficulty.id} value={difficulty.id}>
                          <div>
                            <div className="font-medium">{difficulty.name}</div>
                            <div className="text-sm text-gray-500">{difficulty.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subject Selection */}
          {selectedCourse && (
            <Card>
              <CardHeader>
                <CardTitle>Subject Selection</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {selectedCourse.subjects.map(subject => (
                      <div key={subject} className="flex items-center space-x-2">
                        <Checkbox
                          id={subject}
                          checked={testConfig.subjects.includes(subject)}
                          onCheckedChange={(checked) => handleSubjectChange(subject, checked as boolean)}
                        />
                        <Label htmlFor={subject} className="font-medium">{subject}</Label>
                      </div>
                    ))}
                  </div>
                  
                  {testConfig.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {testConfig.subjects.map(subject => (
                        <Badge key={subject} variant="secondary">{subject}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chapter Selection */}
          {testConfig.subjects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Chapter Selection (Optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getAvailableChapters().map(chapter => (
                      <div key={chapter} className="flex items-center space-x-2">
                        <Checkbox
                          id={chapter}
                          checked={testConfig.chapters.includes(chapter)}
                          onCheckedChange={(checked) => handleChapterChange(chapter, checked as boolean)}
                        />
                        <Label htmlFor={chapter}>{chapter}</Label>
                      </div>
                    ))}
                  </div>
                  
                  {testConfig.chapters.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {testConfig.chapters.map(chapter => (
                        <Badge key={chapter} variant="outline">{chapter}</Badge>
                      ))}
                    </div>
                  )}
                  
                  {testConfig.chapters.length === 0 && (
                    <p className="text-sm text-gray-500">
                      No chapters selected. Questions will be selected from all chapters of the selected subjects.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Advanced Options */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="shuffleQuestions"
                    checked={testConfig.shuffleQuestions}
                    onCheckedChange={(checked) => setTestConfig(prev => ({ 
                      ...prev, 
                      shuffleQuestions: checked as boolean 
                    }))}
                  />
                  <Label htmlFor="shuffleQuestions">Shuffle Questions</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="shuffleOptions"
                    checked={testConfig.shuffleOptions}
                    onCheckedChange={(checked) => setTestConfig(prev => ({ 
                      ...prev, 
                      shuffleOptions: checked as boolean 
                    }))}
                  />
                  <Label htmlFor="shuffleOptions">Shuffle Answer Options</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Test Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Test Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Configuration</h4>
                    <ul className="mt-2 space-y-1 text-sm text-gray-600">
                      <li>Title: {testConfig.title || 'Not specified'}</li>
                      <li>Course: {selectedCourse?.name || 'Not selected'}</li>
                      <li>Questions: {testConfig.totalQuestions}</li>
                      <li>Duration: {testConfig.duration} minutes</li>
                      <li>Difficulty: {difficulties.find(d => d.id === testConfig.difficulty)?.name}</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900">Content</h4>
                    <ul className="mt-2 space-y-1 text-sm text-gray-600">
                      <li>Subjects: {testConfig.subjects.length || 'None selected'}</li>
                      <li>Chapters: {testConfig.chapters.length || 'All chapters'}</li>
                      <li>Question shuffling: {testConfig.shuffleQuestions ? 'Yes' : 'No'}</li>
                      <li>Option shuffling: {testConfig.shuffleOptions ? 'Yes' : 'No'}</li>
                    </ul>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-4">
                  <Button variant="outline" onClick={() => router.back()}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTest} className="bg-blue-600 hover:bg-blue-700">
                    <Play className="h-4 w-4 mr-2" />
                    Create & Start Test
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}