"use client";
import React, { useEffect } from "react";
import { motion, useAnimation, useInView } from "framer-motion";
import { cn } from "@/lib/utils";

export const TextGenerateEffect = ({
    words,
    className,
}: {
    words: string;
    className?: string;
}) => {
    // Split by words, but preserve formatting if needed by passing array. 
    // For simplicity here, we assume a string.
    const wordsArray = words.split(" ");

    const controls = useAnimation();
    const ref = React.useRef(null);
    const isInView = useInView(ref, { once: true });

    useEffect(() => {
        if (isInView) {
            controls.start("visible");
        }
    }, [isInView]);

    const variants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
    };

    const childVariants = {
        hidden: { opacity: 0, y: 20, filter: "blur(10px)" },
        visible: { opacity: 1, y: 0, filter: "blur(0px)" },
    };

    return (
        <motion.div ref={ref} className={cn("font-bold", className)}>
            <motion.div
                variants={variants}
                initial="hidden"
                animate={controls}
            >
                {wordsArray.map((word, idx) => {
                    return (
                        <motion.span
                            key={word + idx}
                            variants={childVariants}
                            className="dark:text-white text-black opacity-0 inline-block mr-2"
                        >
                            {word}
                        </motion.span>
                    );
                })}
            </motion.div>
        </motion.div>
    );
};
