import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Package,
  Boxes,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  Bell,
  LogOut,
  Search,
  Calendar,
  ChevronDown,
  Globe,
  Check,
} from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { CommandPaletteModal } from './CommandPaletteModal.jsx';
import { NotificationDrawer } from './NotificationDrawer.jsx';

const NAV_ITEMS = [
  { name: 'Dashboard',        path: '/',          icon: LayoutDashboard },
  { name: 'Billing (POS)',    path: '/billing',   icon: Receipt },
  { name: 'Products',         path: '/products',  icon: Package },
  { name: 'Stock / Purchase', path: '/stock',     icon: Boxes },
  { name: 'Customers',        path: '/customers', icon: Users },
  { name: 'Reports',          path: '/reports',   icon: BarChart3 },
  { name: 'Settings',         path: '/settings',  icon: Settings },
];

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const mainRef = useRef(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedLang, setSelectedLang] = useState(() => localStorage.getItem('app_lang') || 'en');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  // Global Cmd/Ctrl + K shortcut to toggle search palette
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close drawers and dropdowns on route navigation
  useEffect(() => {
    setDrawerOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Track main vertical scroller for top bar background blur
  const handleScroll = (e) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop >= 8) {
      if (!isScrolled) setIsScrolled(true);
    } else {
      if (isScrolled) setIsScrolled(false);
    }
  };

  const handleLangChange = (lang) => {
    setSelectedLang(lang);
    localStorage.setItem('app_lang', lang);
  };

  // Format today's date for top bar date pill
  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date());

  const userInitials = (user?.name || 'Owner')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-[#050805] text-[#F4F7F1] antialiased">
      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* STATIC PERSISTENT SIDEBAR (Tablet & Desktop: 768px+) */}
      <aside
        id="app-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 md:z-20 flex flex-col justify-between bg-[#0B110C] border-r border-white/5 select-none shrink-0',
          // Desktop fixed widths (NO width transitions, strictly screen-based):
          // 768px - 1023px: 76px icon rail
          // 1024px - 1279px: 232px
          // 1280px+: 262px
          'md:static md:translate-x-0 md:w-[76px] lg:w-[232px] xl:w-[262px]',
          drawerOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Soft static green swoosh glow at sidebar bottom */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-[#B6F23B]/10 via-[#B6F23B]/3 to-transparent" />

        {/* Top: Logo & Brand Header */}
        <div className="h-20 px-4 lg:px-6 flex items-center justify-between shrink-0 relative z-10 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            {/* Neon Dumbbell Mark SVG */}
            <div className="w-10 h-10 rounded-2xl bg-[#B6F23B]/10 border border-[#B6F23B]/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(182,242,59,0.25)]">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#B6F23B] fill-current" strokeWidth="0">
                <path d="M6 5h2v14H6zm10 0h2v14h-2zm-5 6h4v2h-4zM3 8h2v8H3zm16 0h2v8h-2z" />
              </svg>
            </div>
            {/* Two-line shop branding (Hidden on 76px tablet icon rail) */}
            <div className="hidden lg:block leading-tight">
              <span className="block text-base font-black tracking-tight text-white uppercase">Chava</span>
              <span className="block text-[11px] font-bold tracking-wider text-[#9BA79A] uppercase -mt-0.5">
                Fitness Club
              </span>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="md:hidden text-[#9BA79A] hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center: Navigation Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto relative z-10">
          {NAV_ITEMS.map(({ name, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-none group',
                  isActive
                    ? 'bg-[#B6F23B] text-[#0A0F05] shadow-[0_0_20px_rgba(182,242,59,0.35)] font-bold'
                    : 'text-[#9BA79A] hover:text-[#F4F7F1] hover:bg-white/[0.04]'
                )
              }
            >
              <Icon className="w-5 h-5 shrink-0 transition-none" />
              <span className="hidden lg:inline-block truncate transition-none">{name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom: User Card & Dropdown */}
        <div className="p-3 relative z-10 border-t border-white/[0.04]">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="w-full flex items-center justify-between p-2 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#B6F23B]/15 border border-[#B6F23B]/30 flex items-center justify-center text-[#B6F23B] font-extrabold text-xs shrink-0">
                  {userInitials}
                </div>
                <div className="hidden lg:block text-left min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {user?.name || 'Chava Owner'}
                  </p>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#B6F23B]/10 text-[#B6F23B] uppercase tracking-wider mt-0.5">
                    {user?.role || 'Owner'}
                  </span>
                </div>
              </div>
              <ChevronDown className="hidden lg:block w-4 h-4 text-[#9BA79A] shrink-0" />
            </button>

            {/* Dropdown Popup */}
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#0B110C] border border-white/10 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-50">
                <div className="px-3 py-2 border-b border-white/5 mb-1.5">
                  <p className="text-xs font-bold text-white">{user?.name || 'Chava Owner'}</p>
                  <p className="text-[10px] text-[#9BA79A]">{user?.phone || '9876543210'}</p>
                </div>

                {/* Language Switcher */}
                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#9BA79A] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Language
                </div>
                <div className="space-y-0.5 px-1 mb-2">
                  {[
                    { id: 'en', label: 'English' },
                    { id: 'hi', label: 'हिन्दी (Hindi)' },
                    { id: 'mr', label: 'मराठी (Marathi)' },
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => handleLangChange(lang.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors',
                        selectedLang === lang.id
                          ? 'bg-[#B6F23B]/10 text-[#B6F23B] font-bold'
                          : 'text-[#9BA79A] hover:text-white hover:bg-white/5'
                      )}
                    >
                      <span>{lang.label}</span>
                      {selectedLang === lang.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>

                <div className="border-t border-white/5 pt-1">
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* SINGLE VERTICAL SCROLLER (<main>) */}
      <main
        id="app-main-scroller"
        ref={mainRef}
        onScroll={handleScroll}
        className="flex-1 h-full overflow-y-auto overscroll-contain [scrollbar-gutter:stable] relative flex flex-col min-w-0"
      >
        {/* Sticky Top Bar (Transparent by default, blurred dark when scrolled >= 8px) */}
        <header
          className={cn(
            'sticky top-0 z-30 h-20 px-4 sm:px-8 flex items-center justify-between shrink-0 transition-all duration-200',
            isScrolled
              ? 'bg-[#050805]/85 backdrop-blur-md border-b border-white/[0.06] shadow-lg'
              : 'bg-transparent border-b border-transparent'
          )}
        >
          {/* Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="md:hidden p-2 rounded-xl border border-white/10 text-[#9BA79A] hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Center / Right: Search pill, Notifications, Date pill */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Search Pill with Cmd/Ctrl + K Hint */}
            <div
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-[#9BA79A] hover:border-white/20 transition-all cursor-pointer"
            >
              <Search className="w-4 h-4 text-[#9BA79A]" />
              <span className="hidden md:inline">Search anything...</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-white/70 border border-white/10">
                ⌘K
              </kbd>
            </div>

            {/* Notification Bell with Badge */}
            <button
              onClick={() => setNotificationOpen(true)}
              className="relative p-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-white/20 text-[#9BA79A] hover:text-white transition-all cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {notificationCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#B6F23B] text-[#050805] text-[10px] font-extrabold flex items-center justify-center shadow-[0_0_8px_#B6F23B]">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              ) : (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#B6F23B] shadow-[0_0_8px_#B6F23B]" />
              )}
            </button>

            {/* Localized Date Pill */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-[#F4F7F1]">
              <Calendar className="w-3.5 h-3.5 text-[#B6F23B]" />
              <span>{todayFormatted}</span>
            </div>
          </div>
        </header>

        {/* Command Palette Search Modal */}
        <CommandPaletteModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

        {/* Notifications Drawer */}
        <NotificationDrawer
          isOpen={notificationOpen}
          onClose={() => setNotificationOpen(false)}
          onCountUpdate={setNotificationCount}
        />

        {/* Main Content Area */}
        <div className="flex-1 px-4 sm:px-8 py-4 sm:py-6 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}
