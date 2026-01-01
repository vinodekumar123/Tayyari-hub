// Design tokens for consistent styling across the application
// Based on the rgb(0, 74, 173) brand color

export const brandColors = {
    // Primary brand colors
    primary: {
        DEFAULT: '#004AAD',
        light: '#0066FF',
        dark: '#003376',
        lighter: '#00B4D8',
        lightest: '#66D9EF',
    },

    // Status colors
    success: {
        DEFAULT: '#00B4D8',
        light: '#66D9EF',
    },

    warning: {
        DEFAULT: '#F59E0B',
        light: '#FCD34D',
    },

    error: {
        DEFAULT: '#EF4444',
        light: '#FCA5A5',
    },
} as const;

// Spacing scale (in rem)
export const spacing = {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
    '3xl': '4rem',   // 64px
} as const;

// Typography scale
export const typography = {
    fontSize: {
        xs: '0.75rem',     // 12px
        sm: '0.875rem',    // 14px
        base: '1rem',      // 16px
        lg: '1.125rem',    // 18px
        xl: '1.25rem',     // 20px
        '2xl': '1.5rem',   // 24px
        '3xl': '1.875rem', // 30px
        '4xl': '2.25rem',  // 36px
        '5xl': '3rem',     // 48px
    },
    fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        black: '900',
    },
} as const;

// Animation presets
export const animations = {
    // Hover effects
    smoothScale: 'transition-transform duration-300 ease-out hover:scale-105',
    smoothScaleSmall: 'transition-transform duration-200 ease-out hover:scale-[1.02]',
    smoothRotate: 'transition-transform duration-300 ease-out hover:rotate-12',

    // Fade animations
    fadeIn: 'animate-in fade-in duration-500',
    fadeOut: 'animate-out fade-out duration-300',

    // Slide animations
    slideInFromTop: 'animate-in slide-in-from-top duration-400',
    slideInFromBottom: 'animate-in slide-in-from-bottom duration-400',
    slideInFromLeft: 'animate-in slide-in-from-left duration-400',
    slideInFromRight: 'animate-in slide-in-from-right duration-400',

    // Combined animations
    scaleAndFade: 'animate-in fade-in zoom-in duration-500',

    // Transitions
    smooth: 'transition-all duration-300 ease-out',
    fast: 'transition-all duration-150 ease-out',
    slow: 'transition-all duration-500 ease-out',
} as const;

// Shadow system with brand colors
export const shadows = {
    // Standard shadows
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    '2xl': 'shadow-2xl',

    // Brand color shadows (for glassmorphism effects)
    brand: {
        sm: 'shadow-lg shadow-[#004AAD]/10 dark:shadow-[#0066FF]/20',
        md: 'shadow-xl shadow-[#004AAD]/20 dark:shadow-[#0066FF]/30',
        lg: 'shadow-2xl shadow-[#004AAD]/30 dark:shadow-[#0066FF]/40',
    },

    accent: {
        sm: 'shadow-lg shadow-[#00B4D8]/10 dark:shadow-[#66D9EF]/20',
        md: 'shadow-xl shadow-[#00B4D8]/20 dark:shadow-[#66D9EF]/30',
    },
} as const;

// Border radius scale
export const borderRadius = {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
    full: 'rounded-full',
} as const;

// Glassmorphism presets
export const glassmorphism = {
    light: 'bg-card/60 dark:bg-card/40 backdrop-blur-xl',
    medium: 'bg-card/70 dark:bg-card/50 backdrop-blur-2xl',
    heavy: 'bg-card/80 dark:bg-card/60 backdrop-blur-3xl',
} as const;

// Gradient presets using brand colors
export const gradients = {
    primary: 'bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8]',
    primaryDark: 'dark:from-[#003376] dark:via-[#004AAD] dark:to-[#0066FF]',

    accent: 'bg-gradient-to-r from-[#00B4D8] to-[#66D9EF]',
    accentDark: 'dark:from-[#0066FF] dark:to-[#00B4D8]',

    subtle: 'bg-gradient-to-br from-[#004AAD]/5 via-transparent to-[#00B4D8]/5',
    subtleDark: 'dark:from-[#004AAD]/10 dark:to-[#0066FF]/10',

    glow: 'bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] rounded-3xl blur-xl',
} as const;

// Utility function to combine classes
export function cn(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(' ');
}

// Helper to create consistent card styles
export const cardStyles = {
    glass: cn(
        glassmorphism.light,
        borderRadius.lg,
        shadows.brand.sm,
        'border border-[#004AAD]/10 dark:border-[#0066FF]/20',
        animations.smooth
    ),

    solid: cn(
        'bg-card',
        borderRadius.lg,
        shadows.md,
        'border border-border',
        animations.smooth
    ),

    gradient: cn(
        gradients.primary,
        gradients.primaryDark,
        borderRadius.lg,
        shadows.brand.md,
        'text-white',
        animations.smooth
    ),
} as const;
