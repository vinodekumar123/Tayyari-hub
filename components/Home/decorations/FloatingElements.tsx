"use client";

import React, { useState, useEffect } from "react";


const floatingIcons = [
    { icon: "🧬", label: "Biology", delay: 0 },
    { icon: "⚛️", label: "Physics", delay: 1 },
    { icon: "🧪", label: "Chemistry", delay: 2 },
    { icon: "🩺", label: "Medical", delay: 0.5 },
    { icon: "📚", label: "Study", delay: 1.5 },
    { icon: "🧠", label: "Brain", delay: 2.5 },
];

export const FloatingElements = () => {
    // defined type for state items including the original item properties + random values
    const [elements, setElements] = useState<any[]>([]);

    useEffect(() => {
        // Generate positions only on client side to avoid hydration mismatch
        const newElements = floatingIcons.map((item) => ({
            ...item,
            top: `${Math.random() * 80 + 10}%`,
            left: `${Math.random() * 90}%`,
            duration: 5 + Math.random() * 3,
        }));
        setElements(newElements);
    }, []);

    // Return null on server/initial render to avoid mismatch
    if (elements.length === 0) return null;

    return (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            {elements.map((item, index) => (
                <div
                    key={index}
                    className="absolute hidden md:block select-none animate-float"
                    style={{
                        top: item.top,
                        left: item.left,
                        fontSize: '2.5rem',
                        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))',
                        animationDuration: `${item.duration}s`,
                        animationDelay: `${item.delay}s`
                    }}
                >
                    {item.icon}
                </div>
            ))}
        </div>
    );
};
