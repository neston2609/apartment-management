/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"IBM Plex Sans Thai"', '"Sarabun"', 'system-ui', 'sans-serif'],
            },
            colors: {
                brand: {
                    50:  '#eff6ff',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                },
            },
        },
    },
    plugins: [],
};
