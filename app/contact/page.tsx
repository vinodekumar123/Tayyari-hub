import { Metadata } from 'next';
import Navbar from '@/components/Home/navbar';
import Footer from '@/components/Home/footer';
import { ContactContent } from '@/components/Contact/contact-content';

export const metadata: Metadata = {
    title: 'Contact Us - Tayyari Hub & Medico Engineer',
    description: 'Get in touch with Tayyari Hub and Medico Engineer for support and inquiries.',
};

export default function ContactPage() {
    return (
        <main className="min-h-screen flex flex-col">
            <Navbar />
            <div className="flex-grow">
                <ContactContent />
            </div>
            <Footer />
        </main>
    );
}
