import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Kampit — small steps, serious momentum',
  description: 'Turn the skills you keep putting off into daily momentum. Personal goals, weekly competitions and a little friendly rivalry.',
  icons: {icon:'/favicon.svg',shortcut:'/favicon.svg'},
};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
