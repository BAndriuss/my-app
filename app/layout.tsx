import './globals.css'

export const metadata = {
    title: 'My App',
    description: 'Generated by create next app',
  }
  
  export default function RootLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    return (
      <html lang="en">
        <body className="font-kayak bg-gray-100">
          {children}
        </body>
      </html>
    )
  }