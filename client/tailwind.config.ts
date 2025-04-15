/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{jsx,tsx}", "./*.html"],
    theme: {
        extend: {
            colors: {
                dark: "#1a1b26",
                darkHover: "#2a2b3a",
                light: "#e0e0e0",
                primary: "#7aa2f7",
                danger: "#f7768e",
                accent: "#bb9af7",
                success: "#9ece6a"
            },
            fontFamily: {
                inter: ["Inter", "sans-serif"],
            },
            animation: {
                "up-down": "up-down 2s ease-in-out infinite alternate",
                "fade-in": "fade-in 0.5s ease-in-out",
                "slide-in": "slide-in 0.5s ease-out",
                "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            },
            keyframes: {
                "fade-in": {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" }
                },
                "slide-in": {
                    "0%": { transform: "translateX(-100%)" },
                    "100%": { transform: "translateX(0)" }
                }
            }
        },
    },
    plugins: [],
}
