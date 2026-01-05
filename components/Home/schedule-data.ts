
import { CheckCircle2, Microscope, FlaskConical, Atom, BrainCircuit } from 'lucide-react';
import React from 'react';

// --- Freshers Data ---
export const freshersCards = [
    {
        title: "Biology Series",
        subtitle: "Chapter-wise Coverage",
        stats: "16+ Tests & 1600 MCQs",
        icon: "Microscope", // We'll handle icons in component
        color: "emerald",
        features: ["100 MCQs/Chapter", "XI & XII Complete", "Explanations"]
    },
    {
        title: "Chemistry Series",
        subtitle: "Organic & Inorganic",
        stats: "20+ Tests & 2000 MCQs",
        icon: "FlaskConical",
        color: "blue",
        features: ["100 MCQs/Chapter", "XI & XII Complete", "Reaction Maps"]
    },
    {
        title: "Physics Series",
        subtitle: "Conceptual Clarity",
        stats: "20+ Tests & 2000 MCQs",
        icon: "Atom",
        color: "violet",
        features: ["100 MCQs/Chapter", "XI & XII Complete", "Numerical Drills"]
    },
    {
        title: "English & Logic",
        subtitle: "Verbal & Reasoning",
        stats: "20+ Tests",
        icon: "BrainCircuit",
        color: "rose",
        features: ["500+ Practice MCQs", "Vocabulary Builder", "Logic Patterns"]
    }
];

export const freshersClassXII = [
    { date: "01 Feb", code: "CW-XII-01", subject: "Biology", topic: "Homeostasis" },
    { date: "03 Feb", code: "CW-XII-02", subject: "Physics", topic: "Molecular Theory of Gas" },
    { date: "06 Feb", code: "CW-XII-03", subject: "Chemistry", topic: "Representative Elements" },
    { date: "08 Feb", code: "CW-XII-04", subject: "Biology", topic: "Support & Movement" },
    { isCombined: true, date: "10 Feb", code: "GT-XII-01", topic: "Coverage: CW-XII-01 → CW-XII-04 (first 4 chapters)" },
    { date: "13 Feb", code: "CW-XII-05", subject: "Physics", topic: "First Law of Thermodynamics" },
    { date: "15 Feb", code: "CW-XII-06", subject: "Chemistry", topic: "D-Block Elements" },
    { date: "17 Feb", code: "CW-XII-07", subject: "Biology", topic: "Nervous Coordination" },
    { date: "20 Feb", code: "CW-XII-08", subject: "Physics", topic: "Magnetic Field" },
    { isCombined: true, date: "22 Feb", code: "GT-XII-02", topic: "Coverage: CW-XII-05 → CW-XII-08" },
    { date: "24 Feb", code: "CW-XII-09", subject: "Chemistry", topic: "Organic Compounds + Nomenclature" },
    { date: "27 Feb", code: "CW-XII-10", subject: "Biology", topic: "Reproduction" },
    { date: "01 Mar", code: "CW-XII-11", subject: "Physics", topic: "Electromagnetic Induction" },
    { date: "03 Mar", code: "CW-XII-12", subject: "Chemistry", topic: "Hydrocarbons" },
    { isCombined: true, date: "05 Mar", code: "GT-XII-03", topic: "Coverage: CW-XII-09 → CW-XII-12" },
    { date: "06 Mar", code: "CW-XII-13", subject: "Biology", topic: "Inheritance" },
    { date: "08 Mar", code: "CW-XII-14", subject: "Physics", topic: "Alternating Current" },
    { date: "10 Mar", code: "CW-XII-15", subject: "Chemistry", topic: "Alkyl Halides & Amines" },
    { date: "13 Mar", code: "CW-XII-16", subject: "Biology", topic: "Evolution" },
    { isCombined: true, date: "15 Mar", code: "GT-XII-04", topic: "Coverage: CW-XII-13 → CW-XII-16" },
    { date: "15 Mar", code: "CW-XII-17", subject: "Physics", topic: "Solid State Electronics" },
    { date: "17 Mar", code: "CW-XII-18", subject: "Chemistry", topic: "Alcohols, Phenols & Ethers" },
    { date: "20 Mar", code: "CW-XII-19", subject: "Biology", topic: "Biotechnology" },
    { date: "22 Mar", code: "CW-XII-20", subject: "Physics", topic: "Quantum Physics" },
    { date: "24 Mar", code: "CW-XII-21", subject: "Chemistry", topic: "Aldehydes & Ketones" },
    { date: "27 Mar", code: "CW-XII-22", subject: "Physics", topic: "Atomic Physics" },
    { date: "29 Mar", code: "CW-XII-23", subject: "Physics", topic: "Nuclear Physics" },
    { date: "29 Mar", code: "CW-XII-24", subject: "Chemistry", topic: "Carboxylic Acids + Biochemistry + Industrial Chemistry" },
    { isCombined: true, date: "31 Mar", code: "GT-XII-05", topic: "Coverage: CW-XII-17 → CW-XII-24 (last 8 chapters)" },
    { isCombined: true, isFull: true, date: "05 Apr", code: "GT-XII-06 (Full XII)", topic: "Coverage: All XII Chapters (CW-XII-01 → CW-XII-24)" },
];

export const freshersClassXI = [
    { date: "28 Apr", code: "CW-XI-01", subject: "Biology", topic: "Biological Molecules" },
    { date: "01 May", code: "CW-XI-02", subject: "Physics", topic: "Kinematics" },
    { date: "03 May", code: "CW-XI-03", subject: "Chemistry", topic: "Stoichiometry" },
    { date: "05 May", code: "CW-XI-04", subject: "Biology", topic: "Enzymes" },
    { isCombined: true, date: "08 May", code: "GT-XI-01", topic: "Coverage: CW-XI-01 → CW-XI-04" },
    { date: "10 May", code: "CW-XI-05", subject: "Physics", topic: "Dynamics" },
    { date: "12 May", code: "CW-XI-06", subject: "Chemistry", topic: "Atomic Structure" },
    { date: "15 May", code: "CW-XI-07", subject: "Biology", topic: "Cell Structure & Function" },
    { date: "17 May", code: "CW-XI-08", subject: "Physics", topic: "Rotational & Circular Motion" },
    { isCombined: true, date: "19 May", code: "GT-XI-02", topic: "Coverage: CW-XI-05 → CW-XI-08" },
    { date: "19 May", code: "CW-XI-09", subject: "Chemistry", topic: "Chemical Bonding" },
    { date: "22 May", code: "CW-XI-10", subject: "Biology", topic: "Bioenergetics" },
    { date: "24 May", code: "CW-XI-11", subject: "Physics", topic: "Work, Power & Energy" },
    { date: "26 May", code: "CW-XI-12", subject: "Chemistry", topic: "State of Matter (Gas)" },
    { isCombined: true, date: "29 May", code: "GT-XI-03", topic: "Coverage: CW-XI-09 → CW-XI-12" },
    { date: "31 May", code: "CW-XI-13", subject: "Biology", topic: "Acellular Life" },
    { date: "02 Jun", code: "CW-XI-14", subject: "Physics", topic: "Fluid Dynamics" },
    { date: "05 Jun", code: "CW-XI-15", subject: "Chemistry", topic: "Liquids" },
    { date: "07 Jun", code: "CW-XI-16", subject: "Biology", topic: "Holozoic Nutrition" },
    { isCombined: true, date: "09 Jun", code: "GT-XI-04", topic: "Coverage: CW-XI-13 → CW-XI-16" },
    { date: "09 Jun", code: "CW-XI-17", subject: "Physics", topic: "Electric Field" },
    { date: "12 Jun", code: "CW-XI-18", subject: "Chemistry", topic: "State of Matter (Solid)" },
    { date: "14 Jun", code: "CW-XI-19", subject: "Biology", topic: "Circulation" },
    { date: "16 Jun", code: "CW-XI-20", subject: "Physics", topic: "Capacitors" },
    { date: "19 Jun", code: "CW-XI-21", subject: "Chemistry", topic: "Chemical Equilibrium" },
    { date: "21 Jun", code: "CW-XI-22", subject: "Biology", topic: "Immunity" },
    { date: "23 Jun", code: "CW-XI-23", subject: "Physics", topic: "DC Circuits" },
    { date: "25 Jun", code: "CW-XI-24", subject: "Chemistry", topic: "Chemical Kinetics" },
    { date: "25 Jun", code: "CW-XI-25", subject: "Biology", topic: "Gaseous Exchange" },
    { date: "27 Jun", code: "CW-XI-26", subject: "Physics", topic: "Oscillations" },
    { date: "29 Jun", code: "CW-XI-27", subject: "Chemistry", topic: "Thermochemistry + Electrochemistry" },
    { date: "01 Jul", code: "CW-XI-28", subject: "Physics", topic: "Acoustics" },
    { isCombined: true, date: "03 Jul", code: "GT-XI-05", topic: "Coverage: CW-XI-17 → CW-XI-28 (last 12 chapters)" },
    { isCombined: true, isFull: true, date: "05 Jul", code: "GT-XI-06 (Full XI)", topic: "Coverage: All XI Chapters (CW-XI-01 to CW-XI-28)" },
];

// --- Improvers Data ---
export const improversS1 = [
    { test: 1, date: "15 Jan", day: "Wed", topics: "Biology XI: Biological Molecules, Enzymes<br>Chemistry XI: Stoichiometry<br>Physics XI: Kinematics<br>English: Tenses, Prepositions<br>Logical Reasoning: Complete Topics" },
    { test: 2, date: "18 Jan", day: "Sat", topics: "Biology XI: Cell Structure & Function, Bioenergetics<br>Chemistry XI: Atomic Structure<br>Physics XI: Dynamics<br>English: Gerunds & Infinitives, Voice<br>Logical Reasoning: Complete Topics" },
    { test: 3, date: "22 Jan", day: "Wed", topics: "Biology XI: Acellular Life, Holozoic Nutrition<br>Chemistry XI: Chemical Bonding<br>Physics XI: Rotational & Circular Motion<br>English: Narration, Sentence Correction<br>Logical Reasoning: Complete Topics" },
    { test: 4, date: "25 Jan", day: "Sat", topics: "Biology XI: Circulation, Immunity<br>Chemistry XI: State of Matter (Gases)<br>Physics XI: Work, Power & Energy<br>English: Tenses, Punctuation<br>Logical Reasoning: Complete Topics" },
    { test: 5, date: "29 Jan", day: "Wed", topics: "Biology XI: Gaseous Exchange<br>Chemistry XI: State of Matter (Liquids & Solids)<br>Physics XI: Fluid Dynamics<br>English: Prepositions, Gerunds & Infinitives<br>Logical Reasoning: Complete Topics" },
    { test: 6, date: "1 Feb", day: "Sat", topics: "Biology XII: Homeostasis<br>Chemistry XI: Chemical Equilibrium<br>Physics XI: Electric Fields, Capacitors<br>English: Voice, Narration<br>Logical Reasoning: Complete Topics" },
    { test: 7, date: "5 Feb", day: "Wed", topics: "Biology XII: Support & Movement<br>Chemistry XI: Chemical Kinetics, Thermochemistry<br>Physics XI: DC Circuits<br>English: Sentence Correction, Punctuation<br>Logical Reasoning: Complete Topics" },
    { test: 8, date: "8 Feb", day: "Sat", topics: "Biology XII: Nervous Coordination<br>Chemistry XI: Electrochemistry<br>Physics XI: Oscillations, Acoustics<br>English: Tenses, Gerunds & Infinitives<br>Logical Reasoning: Complete Topics" },
    { test: 9, date: "12 Feb", day: "Wed", topics: "FULL XI SYLLABUS - Biology, Chemistry, Physics<br>English: Complete Topics<br>Logical Reasoning: Complete Topics" },
    { test: 10, date: "15 Feb", day: "Sat", topics: "Biology XII: Reproduction<br>Chemistry XII: Representative Elements<br>Physics XII: Molecular Theory of Gas<br>English: Tenses, Prepositions<br>Logical Reasoning: Complete Topics" },
    { test: 11, date: "19 Feb", day: "Wed", topics: "Biology XII: Inheritance<br>Chemistry XII: D-Block Elements<br>Physics XII: First Law of Thermodynamics<br>English: Gerunds & Infinitives, Voice<br>Logical Reasoning: Complete Topics" },
    { test: 12, date: "22 Feb", day: "Sat", topics: "Biology XII: Evolution<br>Chemistry XII: Organic Compounds, Nomenclature<br>Physics XII: Magnetic Field, Electromagnetic Induction<br>English: Sentence Correction, Punctuation<br>Logical Reasoning: Complete Topics" },
    { test: 13, date: "26 Feb", day: "Wed", topics: "Biology XII: Biotechnology<br>Chemistry XII: Hydrocarbons<br>Physics XII: Alternating Current, Solid State Electronics<br>English: Tenses, Prepositions<br>Logical Reasoning: Complete Topics" },
    { test: 14, date: "1 Mar", day: "Sat", topics: "Biology (Mixed XI + XII): High-Yield Physiology<br>Chemistry XII: Alkyl Halides, Amines, Alcohols, Phenols, Ethers<br>Physics XII: Quantum Physics<br>English: Gerunds & Infinitives, Voice, Narration<br>Logical Reasoning: Complete Topics" },
    { test: 15, date: "5 Mar", day: "Wed", topics: "Biology (Mixed): Genetics + Nervous Coordination<br>Chemistry XII: Aldehydes, Ketones, Carboxylic Acids & Derivatives<br>Physics XII: Nuclear Physics, Atomic Physics<br>English: Sentence Correction, Punctuation<br>Logical Reasoning: Complete Topics" },
    { test: 16, date: "30 Mar", day: "Mon", topics: "FINAL GRAND TEST - FULL XI + XII (All Biology, Chemistry, Physics)<br>English: Complete all topics<br>Logical Reasoning: Complete Topics" },
];

export const improversS2 = [
    { test: 1, date: "1 Apr", day: "Wed", topics: "Biology XI: Biological Molecules, Enzymes<br>Chemistry XI: Stoichiometry<br>Physics XI: Kinematics<br>English: Tenses, Prepositions<br>Logical Reasoning: Complete Topics" },
    { test: 2, date: "4 Apr", day: "Sat", topics: "Biology XI: Cell Structure & Function, Bioenergetics<br>Chemistry XI: Atomic Structure<br>Physics XI: Dynamics<br>English: Gerunds & Infinitives, Voice<br>Logical Reasoning: Complete Topics" },
    { test: 3, date: "8 Apr", day: "Wed", topics: "Biology XI: Acellular Life, Holozoic Nutrition<br>Chemistry XI: Chemical Bonding<br>Physics XI: Rotational & Circular Motion<br>English: Narration, Sentence Correction<br>Logical Reasoning: Complete Topics" },
    { test: 4, date: "11 Apr", day: "Sat", topics: "Biology XI: Circulation, Immunity<br>Chemistry XI: State of Matter (Gases)<br>Physics XI: Work, Power & Energy<br>English: Tenses, Punctuation<br>Logical Reasoning: Complete Topics" },
    { test: 5, date: "15 Apr", day: "Wed", topics: "Biology XI: Gaseous Exchange<br>Chemistry XI: State of Matter (Liquids & Solids)<br>Physics XI: Fluid Dynamics<br>English: Prepositions, Gerunds & Infinitives<br>Logical Reasoning: Complete Topics" },
    { test: 6, date: "18 Apr", day: "Sat", topics: "Biology XII: Homeostasis<br>Chemistry XI: Chemical Equilibrium<br>Physics XI: Electric Fields, Capacitors<br>English: Voice, Narration<br>Logical Reasoning: Complete Topics" },
    { test: 7, date: "22 Apr", day: "Wed", topics: "Biology XII: Support & Movement<br>Chemistry XI: Chemical Kinetics, Thermochemistry<br>Physics XI: DC Circuits<br>English: Sentence Correction, Punctuation<br>Logical Reasoning: Complete Topics" },
    { test: 8, date: "25 Apr", day: "Sat", topics: "Biology XII: Nervous Coordination<br>Chemistry XI: Electrochemistry<br>Physics XI: Oscillations, Acoustics<br>English: Tenses, Gerunds & Infinitives<br>Logical Reasoning: Complete Topics" },
    { test: 9, date: "29 Apr", day: "Wed", topics: "FULL XI SYLLABUS - Biology, Chemistry, Physics<br>English: Complete Topics<br>Logical Reasoning: Complete Topics" },
    { test: 10, date: "2 May", day: "Sat", topics: "Biology XII: Reproduction<br>Chemistry XII: Representative Elements<br>Physics XII: Molecular Theory of Gas<br>English: Tenses, Prepositions<br>Logical Reasoning: Complete Topics" },
    { test: 11, date: "6 May", day: "Wed", topics: "Biology XII: Inheritance<br>Chemistry XII: D-Block Elements<br>Physics XII: First Law of Thermodynamics<br>English: Gerunds & Infinitives, Voice<br>Logical Reasoning: Complete Topics" },
    { test: 12, date: "9 May", day: "Sat", topics: "Biology XII: Evolution<br>Chemistry XII: Organic Compounds, Nomenclature<br>Physics XII: Magnetic Field, Electromagnetic Induction<br>English: Sentence Correction, Punctuation<br>Logical Reasoning: Complete Topics" },
    { test: 13, date: "13 May", day: "Wed", topics: "Biology XII: Biotechnology<br>Chemistry XII: Hydrocarbons<br>Physics XII: Alternating Current, Solid State Electronics<br>English: Tenses, Prepositions<br>Logical Reasoning: Complete Topics" },
    { test: 14, date: "16 May", day: "Sat", topics: "Biology (Mixed XI + XII): High-Yield Physiology<br>Chemistry XII: Alkyl Halides, Amines, Alcohols, Phenols, Ethers<br>Physics XII: Quantum Physics<br>English: Gerunds & Infinitives, Voice, Narration<br>Logical Reasoning: Complete Topics" },
    { test: 15, date: "20 May", day: "Wed", topics: "Biology (Mixed): Genetics + Nervous Coordination<br>Chemistry XII: Aldehydes, Ketones, Carboxylic Acids & Derivatives<br>Physics XII: Nuclear Physics, Atomic Physics<br>English: Sentence Correction, Punctuation<br>Logical Reasoning: Complete Topics" },
    { test: 16, date: "15 Jun", day: "Mon", topics: "FINAL GRAND TEST - FULL XI + XII (All Biology, Chemistry, Physics)<br>English: Complete all topics<br>Logical Reasoning: Complete Topics" },
];
