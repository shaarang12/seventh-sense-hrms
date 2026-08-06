import "./globals.css";

export const metadata = {
  title: "Seventh Sense HRMS",
  description: "Internal Human Resource Management System for Seventh Sense",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
