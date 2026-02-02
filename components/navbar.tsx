import Link from 'next/link';
import Image from 'next/image';
import { UserProfileDropdown } from '@/components/user/user-profile-dropdown';
import { DM_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

type NavbarProps = {
  userName: string | null;
};

export default function Navbar({ userName }: NavbarProps) {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="container mx-auto px-4 py-2">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-4">
              <Image
                src="/report-assistant-icon.jpg"
                alt="Report Assistant Logo"
                width={56}
                height={56}
                className="rounded-xl"
                unoptimized
              />
              <span
                className={cn(
                  'text-lg font-semibold tracking-tight text-blue-800',
                  dmSans.className
                )}
              >
                Report Assistant
              </span>
            </Link>
          </div>
          <div className="flex items-center">
            <UserProfileDropdown userName={userName} />
          </div>
        </div>
      </div>
    </nav>
  );
}
