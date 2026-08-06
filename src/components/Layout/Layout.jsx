--- a/src/components/Layout/Layout.jsx
+++ b/src/components/Layout/Layout.jsx
@@
 import ClassSwitcher from '../ClassSwitcher/ClassSwitcher';
+import AdminLauncher from '../AdminLauncher';
@@
 export default function Layout({ children, showFooter = true }) {
@@
       <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
+      {/* Admin launcher: renders a floating admin button when user.is_admin */}
+      <AdminLauncher />
