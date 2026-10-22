import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Social Groups — Your people. Your next play.',description:'Create a private group, invite friends, and share market ideas.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
