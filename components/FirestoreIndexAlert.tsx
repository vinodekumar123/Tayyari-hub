import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ExternalLink, AlertTriangle } from "lucide-react";

interface FirestoreIndexAlertProps {
    error: any;
    className?: string;
}

export function FirestoreIndexAlert({ error, className }: FirestoreIndexAlertProps) {
    if (!error) return null;

    // Firestore error code for missing index is 'failed-precondition'
    // The message typically contains "The query requires an index." and a link.
    const isIndexError = error?.code === 'failed-precondition' && error?.message?.includes('index');

    if (!isIndexError) return null;

    const urlMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
    const url = urlMatch ? urlMatch[0] : null;

    return (
        <Alert variant="destructive" className={`bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900 ${className || ''}`}>
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <AlertTitle className="text-amber-800 dark:text-amber-400">Missing Firestore Index</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-500">
                <p className="mb-2">This query requires a composite index to run successfully.</p>
                {url && (
                    <Button variant="outline" size="sm" className="bg-white dark:bg-black border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 hover:text-amber-800 mt-2" asChild>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 mr-2" />
                            Create Index
                        </a>
                    </Button>
                )}
            </AlertDescription>
        </Alert>
    );
}
