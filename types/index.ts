export interface Question {
    id: string;
    subject?: string;
    chapter?: string;
    questionText?: string;
    options?: any[];
    correctAnswer?: string;
    explanation?: string;
    createdAt?: any;
    teacherId?: string;
    teacher?: string; // Teacher display name
    createdBy?: string; // UID for ownership tracking
    difficulty?: string;
    topic?: string;
    subtopic?: string;
    isPublic?: boolean;
    courseId?: string;
    allOptionsCorrect?: boolean;
    year?: string;
    book?: string;
}

export interface QuizConfig {
    title: string;
    course: string;
    subject: string;
    chapter: string;
    totalQuestions: number;
    duration: number;
    maxPerSubject: number;
}

export interface Metadata {
    course?: string;
    courseId?: string;
    subject?: string;
    subjectId?: string;
    chapter?: string;
    chapterId?: string;
    topic?: string;
    difficulty?: string;
    year?: string;
    book?: string;
    teacher?: string;
}

export interface FormState {
    fullName: string;
    email: string;
    phone: string;
    metadata: Metadata;
    subjects?: string[];
}

export interface SubjectItem {
    id: string;
    name: string;
    chapters?: Record<string, any>;
}
export interface Course {
    id: string;
    name: string;
    description?: string;
    subjectIds?: string[];
    [key: string]: any;
}

export interface Quiz {
    id: string;
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    duration: number; // in minutes
    questions?: any[]; // Defined as any for now, can be refined later
    selectedQuestions?: any[];
    published: boolean;
    course: string | { name: string;[key: string]: any }; // Handle both string and object legacy data
    accessType: 'public' | 'series' | 'paid';
    maxAttempts?: number;
    series?: string[];
    [key: string]: any;
}

export interface Student {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    course?: string;
    university?: string;
    campus?: string;
    district?: string;
    degree?: string;
    plan?: 'free' | 'premium';
    uid?: string;
    premium?: boolean;

    // RBAC Fields
    role?: 'student' | 'teacher' | 'admin' | 'superadmin';
    subjects?: string[]; // IDs of subjects assigned to teacher
    admin?: boolean; // @deprecated use role
    superadmin?: boolean; // @deprecated use role

    status?: string;
    profileImage?: string;
    fatherName?: string;
    [key: string]: any;
}

export interface Coupon {
    name: string;
    usageType: 'Single' | 'All';
    limit: number;
    discountPercentage: number;
}

export interface Series {
    id: string;
    courseId: string;
    name: string;
    uniqueId: string;
    year: string;
    expiryDate: string;
    price: number;
    createdBy: string;
    coupons: Coupon[];
    createdAt?: any;
    [key: string]: any;
}

export interface Subject {
    id: string;
    name: string;
    chapters?: string[];
    [key: string]: any;
}

export interface Bundle {
    id: string;
    name: string;
    description?: string;
    price: number;
    seriesIds: string[]; // IDs of Series included in this bundle
    active: boolean;
    createdAt?: any;
    [key: string]: any;
}

export interface EnrollmentRecord {
    id: string;
    // Student Info (Snapshot)
    studentId: string;
    studentName: string;
    studentEmail: string;
    // Series Info (Snapshot)
    seriesId: string;
    seriesName: string;
    bundleId?: string; // Optional: Track if this enrollment came from a bundle
    // Payment Info
    price: number;
    transactionId: string;
    senderName: string;
    paymentDate: string;
    // Admin Info
    enrolledByAdminId: string;
    enrolledByAdminName: string;
    enrolledAt: any;
    // Status
    status: 'active' | 'expired' | 'cancelled' | 'refunded';
    statusHistory: {
        status: string;
        changedBy: string;
        changedAt: any;
        reason?: string;
    }[];
}

// Bulk Delete Types
export interface BulkDeleteRequest {
    studentIds: string[];
    confirmationText?: string;
}

export interface BulkDeleteResponse {
    success: boolean;
    deleted: number;
    failed: number;
    errors: Array<{
        studentId: string;
        studentName?: string;
        error: string;
    }>;
    message: string;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    assignedTo: string; // Teacher UID
    assignedToName: string;
    assignedBy: string; // Admin UID
    status: 'pending' | 'in_progress' | 'completed' | 'reviewed';
    priority: 'low' | 'medium' | 'high';

    startDate: any; // Timestamp
    endDate: any; // Timestamp (Deadline)

    // Financials
    paymentAmount: number;
    paymentStatus: 'pending' | 'paid';
    paymentDate?: any;

    // Review
    rating?: number; // 1-5
    reviewFeedback?: string;

    // Metadata
    createdAt: any;
    updatedAt: any;
}

export interface TaskComment {
    id: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: any;
}

export interface StudyMaterial {
    id: string;
    title: string;
    description?: string;
    type: 'pdf' | 'video' | 'link';
    url: string;
    seriesId: string[];
    subject?: string;
    chapter?: string;
    isFree: boolean;

    // Analytics
    uploadedBy: { uid: string; name: string; role: string };
    downloadCount: number;
    viewCount: number;
    ratings: { userId: string; rating: number; comment?: string }[];
    averageRating: number;

    createdAt: any;
}

export interface ForumPost {
    id: string;
    title: string;
    type?: 'question' | 'discussion' | 'announcement'; // Add type field
    content: string; // HTML/RichText
    images?: string[];
    authorId: string;
    authorName: string;
    authorRole: 'student' | 'admin' | 'teacher';
    subject: string;
    chapter?: string;
    province?: string;
    tags: string[];
    upvotes: number;
    upvotedBy: string[]; // Array of UIDs
    replyCount: number;
    isSolved: boolean;
    createdAt: any;
    editedAt?: any;
    // Moderation
    isDeleted?: boolean;
    deletedAt?: any;
    isPinned?: boolean;
    isFlagged?: boolean;
    flagReason?: string;
}

export interface ForumReply {
    id: string;
    postId: string;
    content: string;
    authorId: string;
    authorName: string; // Snapshot for performance
    authorRole: 'student' | 'admin' | 'teacher';
    isVerified: boolean; // Verified by Faculty
    upvotes: number;
    upvotedBy: string[];
    createdAt: any;
    editedAt?: any;
    // Moderation
    isDeleted?: boolean;
    deletedAt?: any;
    isFlagged?: boolean;
}

