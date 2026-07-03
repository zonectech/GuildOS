'use client';

import { Bell, Search } from 'lucide-react';
import { DashboardMobileMenu } from './dashboard-mobile-menu';

export function DashboardTopbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#F8FAFC]/90 backdrop-blur-xl supports-[backdrop-filter]:bg-[#F8FAFC]/75">
      <div className="flex items-center gap-4 px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
        <DashboardMobileMenu />

        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-2xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search communities, events, members..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white/90 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white"
            />
          </div>
          <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-slate-600 transition hover:bg-white hover:text-slate-900">
            <Bell className="h-4 w-4" />
          </button>
        </div>

        <button className="hidden h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 text-sm font-medium text-slate-700 transition hover:bg-white md:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Guild Leaders Community
        </button>

        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-sm shadow-indigo-500/20">
          TM
        </div>
      </div>
    </header>
  );
}