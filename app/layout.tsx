import "./globals.css";

export const metadata = {
  title: "ATLAS ERP",
  description: "ITLATAM GROUP SAS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="bg-zinc-100">{children}</body>
    </html>
  );
}