/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tell Tailwind which files to scan for class names so unused styles are purged in production
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [
    // @tailwindcss/typography adds the `prose` class for nicely styled HTML content
    // (useful for rendering the shared notes editor output)
    require("@tailwindcss/typography"),
  ],
};
