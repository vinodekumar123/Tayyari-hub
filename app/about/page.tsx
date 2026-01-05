import { Metadata } from 'next';
import Navbar from '@/components/Home/navbar';
import Footer from '@/components/Home/footer';
import { AboutContent } from '@/components/About/about-content';

export const metadata: Metadata = {
    title: 'About Us - Tayyari Hub & Medico Engineer',
    description: 'Learn about Tayyari Hub, our mission, history, and the team behind the platform.',
};

export default function AboutPage() {
    return (
        <main className="min-h-screen flex flex-col">
            <Navbar />
            <div className="flex-grow">
                <AboutContent />
            </div>
            <Footer />
        </main>
    );
}
