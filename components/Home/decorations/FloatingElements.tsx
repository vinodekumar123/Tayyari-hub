"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

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
            {elements.map((item, index) => {
                return (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 50 }}
                        animate={{
                            opacity: [0.3, 0.8, 0.3],
                            y: [0, -20, 0],
                            x: [0, index % 2 === 0 ? 10 : -10, 0]
                        }}
                        transition={{
                            duration: item.duration,
                            repeat: Infinity,
                            repeatType: "mirror",
                            ease: "easeInOut",
                            delay: item.delay
                        }}
                        style={{
                            position: 'absolute',
                            top: item.top,
                            left: item.left,
                            fontSize: '2.5rem',
                            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'
                        }}
                        className="hidden md:block select-none"
                    >
                        {item.icon}
                    </motion.div>
                )
            })}
        </div>
    );
};
