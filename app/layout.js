import "./globals.css";

export const metadata = {
  title: "ASO Review Reply Tool",
  description: "Upload ASO review sheets, detect sentiment, and generate draft replies."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
