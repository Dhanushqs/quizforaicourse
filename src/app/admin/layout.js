// Tells search engines not to list the admin pages.
export const metadata = {
  title: "Quiz Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return children;
}
