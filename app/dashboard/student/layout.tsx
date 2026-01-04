import { QuizNotificationManager } from "@/components/student/QuizNotificationManager";

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <>
            <QuizNotificationManager />
            {children}
        </>
    );
}
