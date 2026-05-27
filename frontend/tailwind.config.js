/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
    theme: {
        extend: {
            fontFamily: {
                sans:    ['"Plus Jakarta Sans"', '"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'],
                display: ['"Space Grotesk"', '"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'],
                mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
            },
            colors: {
                // candy-pop accent palette (ApartMint)
                cyan:     { DEFAULT: '#06b6d4', soft: '#cffafe' },
                violet:   { DEFAULT: '#8b5cf6', soft: '#ede9fe' },
                pink:     { DEFAULT: '#ec4899', soft: '#fce7f3' },
                coral:    { DEFAULT: '#fb7185', soft: '#ffe4e6' },
                orange:   { DEFAULT: '#fb923c', soft: '#ffedd5' },
                sunshine: { DEFAULT: '#fbbf24', soft: '#fef3c7' },
                mint:     { DEFAULT: '#14b8a6', soft: '#ccfbf1' },
                sky:      { DEFAULT: '#38bdf8', soft: '#e0f2fe' },
                lime:     { DEFAULT: '#84cc16', soft: '#ecfccb' },
                cream:    { 0: '#fff3e0', 1: '#ffffff', 2: '#ffe9d0', surface: '#fff5e8', deep: '#ffe1c2' },
                ink:      { DEFAULT: '#1a0e3d', 2: '#4f4570', 3: '#8a82a5', 4: '#b8b1cd' },
                // keep the old brand alias mapped onto violet so legacy classes still read on-theme
                brand: {
                    50:  '#ede9fe',
                    500: '#a78bfa',
                    600: '#8b5cf6',
                    700: '#7c3aed',
                },
            },
            backgroundImage: {
                'grad-aurora': 'linear-gradient(135deg, #38bdf8 0%, #8b5cf6 50%, #ec4899 100%)',
                'grad-sunset': 'linear-gradient(135deg, #fbbf24 0%, #fb7185 50%, #ec4899 100%)',
                'grad-cyan':   'linear-gradient(135deg, #38bdf8, #06b6d4)',
                'grad-pink':   'linear-gradient(135deg, #ec4899, #8b5cf6)',
                'grad-warm':   'linear-gradient(135deg, #fbbf24, #fb923c, #ec4899)',
                'grad-mint':   'linear-gradient(135deg, #14b8a6, #06b6d4)',
                'grad-candy':  'linear-gradient(135deg, #38bdf8 0%, #14b8a6 30%, #fbbf24 60%, #ec4899 100%)',
            },
            boxShadow: {
                'soft-sm': '0 2px 8px rgba(50, 20, 80, 0.04)',
                'soft-md': '0 8px 24px rgba(50, 20, 80, 0.06)',
                'soft-lg': '0 20px 48px rgba(50, 20, 80, 0.08)',
                'glow-cyan':   '0 8px 24px rgba(6, 182, 212, 0.25)',
                'glow-violet': '0 8px 24px rgba(139, 92, 246, 0.25)',
                'glow-pink':   '0 8px 24px rgba(236, 72, 153, 0.25)',
            },
        },
    },
    plugins: [],
};
