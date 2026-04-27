import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { addDoc, collection } from 'firebase/firestore';
import {
  BookOpen,
  ChevronDown,
  CreditCard,
  Home,
  LogOut,
  Menu,
  PieChart,
  Plus,
  Shield,
  Tag,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.jsx';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar.jsx';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useLedger } from '@/contexts/LedgerContext';
import { useToastNotifications } from '@/hooks/useToastNotifications';
import { db } from '@/firebase';
import ProfileImage from '@/components/ProfileImage';

const CURRENCY_OPTIONS = [
  { value: 'CNY', label: '¥ Chinese Yuan (CNY)' },
  { value: 'USD', label: '$ US Dollar (USD)' },
  { value: 'EUR', label: '€ Euro (EUR)' },
  { value: 'GBP', label: '£ British Pound (GBP)' },
  { value: 'JPY', label: '¥ Japanese Yen (JPY)' },
];

const GLOBAL_ITEMS = [
  { to: '/', label: 'My Dashboard', icon: Home },
];

const LEDGER_ITEMS = [
  { to: '/overview', label: 'Overview', icon: BookOpen },
  { to: '/transactions', label: 'Transactions', icon: CreditCard },
  { to: '/budgets', label: 'Budgets', icon: PieChart },
  { to: '/categories', label: 'Categories', icon: Tag },
  { to: '/splits', label: 'Splits', icon: Users },
  { to: '/admin', label: 'Admin', icon: Shield },
];

const USER_SETTINGS_ITEM = { to: '/settings', label: 'Your Settings', icon: User };

function isActivePath(pathname, target) {
  if (target === '/') {
    return pathname === target;
  }

  return pathname === target || pathname.startsWith(`${target}/`);
}

function isLedgerPath(pathname) {
  return LEDGER_ITEMS.some((item) => isActivePath(pathname, item.to));
}

function getPageLabel(pathname) {
  const match = [...GLOBAL_ITEMS, ...LEDGER_ITEMS, USER_SETTINGS_ITEM].find(
    (item) => isActivePath(pathname, item.to)
  );

  return match?.label || 'Workspace';
}

function CreateLedgerDialog({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { refreshLedgers, switchLedger } = useLedger();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    currency: 'CNY',
    description: '',
  });

  useToastNotifications({
    error,
    onErrorShown: setError,
  });

  async function handleCreate() {
    if (!currentUser || !formData.name.trim()) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const ledgerRef = await addDoc(collection(db, 'ledgers'), {
        name: formData.name.trim(),
        description: formData.description.trim(),
        currency: formData.currency,
        ownerId: currentUser.uid,
        createdAt: new Date(),
        members: {
          [currentUser.uid]: 'owner',
        },
      });

      await refreshLedgers();
      await switchLedger(ledgerRef.id);
      setFormData({
        name: '',
        currency: 'CNY',
        description: '',
      });
      onOpenChange(false);
      navigate('/overview');
    } catch (createError) {
      console.error('Error creating ledger:', createError);
      setError('Failed to create ledger.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Ledger</DialogTitle>
          <DialogDescription>
            Start a new ledger workspace and jump directly into its Overview page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-ledger-name">Ledger name</Label>
            <Input
              id="new-ledger-name"
              value={formData.name}
              onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
              placeholder="Personal Expenses"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-ledger-currency">Currency</Label>
            <Select
              value={formData.currency}
              onValueChange={(value) => setFormData((current) => ({ ...current, currency: value }))}
              disabled={loading}
            >
              <SelectTrigger id="new-ledger-currency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((currency) => (
                  <SelectItem key={currency.value} value={currency.value}>
                    {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-ledger-description">Description</Label>
            <Input
              id="new-ledger-description"
              value={formData.description}
              onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optional short description"
              disabled={loading}
            />
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || !formData.name.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            {loading ? 'Creating...' : 'Create Ledger'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LedgerSwitcher({ onCreateLedger, compact = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { ledgers, currentLedger, switchLedger, loading } = useLedger();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  if (!currentLedger) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start rounded-2xl border border-dashed border-stone-300 bg-white/70 px-3 py-6 text-stone-700"
        onClick={onCreateLedger}
      >
        <Plus className="h-4 w-4" />
        <span className={compact ? '' : 'group-data-[collapsible=icon]:hidden'}>New Ledger</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start rounded-2xl border border-white/60 bg-white/75 px-3 py-3 text-left shadow-sm"
        >
          <BookOpen className="h-4 w-4 shrink-0" />
          <div className={`min-w-0 flex-1 ${compact ? '' : 'group-data-[collapsible=icon]:hidden'}`}>
            <p className="truncate text-sm font-medium text-stone-900">{currentLedger.name}</p>
            <p className="truncate text-xs text-stone-500">Switch ledger workspace</p>
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-stone-500 ${compact ? '' : 'group-data-[collapsible=icon]:hidden'}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={collapsed && !compact ? 'start' : 'center'}
        className="w-72 rounded-2xl border-stone-200 p-2"
      >
        <DropdownMenuLabel>Ledgers</DropdownMenuLabel>
        {ledgers.map((ledger) => (
          <DropdownMenuItem
            key={ledger.id}
            onClick={async () => {
              await switchLedger(ledger.id);
              if (location.pathname !== '/' && location.pathname !== '/settings') {
                navigate(location.pathname);
              }
            }}
            className="rounded-xl py-2"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{ledger.name}</span>
              <span className="truncate text-xs text-stone-500">{ledger.currency || 'CNY'}</span>
            </div>
            {ledger.id === currentLedger.id && (
              <span className="text-xs text-stone-500">Current</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreateLedger} disabled={loading} className="rounded-xl py-2">
          <Plus className="h-4 w-4" />
          <span>New Ledger</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavMenuItem({ item, pathname }) {
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActivePath(pathname, item.to)}
        tooltip={item.label}
        className="rounded-2xl"
      >
        <Link to={item.to}>
          <Icon className="h-4 w-4" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function ShellSidebar({ onCreateLedger, onLogout }) {
  const location = useLocation();
  const { currentUser } = useAuth();
  const { currentLedger } = useLedger();

  return (
    <Sidebar collapsible="icon" className="border-r border-[rgba(134,109,92,0.14)]">
      <SidebarHeader className="gap-3 px-3 py-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-3 shadow-sm group-data-[collapsible=icon]:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold text-stone-900">BillyBilly</p>
            <p className="text-xs text-stone-500">Ledger workspace</p>
          </div>
        </div>

        <SidebarMenu className="group-data-[collapsible=icon]:items-center">
          {GLOBAL_ITEMS.map((item) => (
            <NavMenuItem key={item.to} item={item} pathname={location.pathname} />
          ))}
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="mx-auto w-[calc(100%-1rem)] group-data-[collapsible=icon]:w-6" />

      <SidebarContent className="px-1 py-2">
        <SidebarGroup>
          <SidebarGroupLabel>{currentLedger ? 'Selected Ledger' : 'No Ledger Yet'}</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-3">
            <div className="group-data-[collapsible=icon]:hidden">
              <LedgerSwitcher onCreateLedger={onCreateLedger} />
            </div>
            {currentLedger ? (
              <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                {LEDGER_ITEMS.map((item) => (
                  <NavMenuItem key={item.to} item={item} pathname={location.pathname} />
                ))}
              </SidebarMenu>
            ) : (
              <div className="rounded-2xl bg-white/65 p-4 text-sm text-stone-600 group-data-[collapsible=icon]:hidden">
                Create a ledger to unlock Overview, transactions, budgets, categories, splits, and admin.
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="mx-auto w-[calc(100%-1rem)] group-data-[collapsible=icon]:w-6" />

      <SidebarFooter className="px-3 py-4">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <SidebarMenu className="flex-1 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:items-center">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActivePath(location.pathname, '/settings')}
                tooltip="Your Settings"
                size="lg"
                className="rounded-2xl"
              >
                <Link to="/settings">
                  <ProfileImage user={currentUser} size="sm" />
                  <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="truncate font-medium text-stone-900">
                      {currentUser?.displayName || currentUser?.email}
                    </p>
                    <p className="truncate text-xs text-stone-500">User settings</p>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            className="shrink-0 rounded-2xl text-stone-600 hover:bg-white/70 hover:text-stone-900 group-data-[collapsible=icon]:hidden"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Logout</span>
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function MobileLedgerDrawer({ open, onOpenChange, onCreateLedger }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentLedger } = useLedger();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[82vw] max-w-none border-stone-200 bg-[#fbf8f4] p-0">
        <SheetHeader className="border-b border-stone-200 px-5 py-5 text-left">
          <SheetTitle className="text-base font-semibold text-stone-900">
            {currentLedger?.name || 'No ledger selected'}
          </SheetTitle>
          <SheetDescription className="text-xs text-stone-500">
            Navigate the selected ledger workspace.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4">
            <LedgerSwitcher onCreateLedger={onCreateLedger} compact />
          </div>

          {currentLedger ? (
            <nav className="space-y-1">
              {LEDGER_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(location.pathname, item.to);

                return (
                  <Button
                    key={item.to}
                    variant="ghost"
                    className={`h-12 w-full justify-start rounded-2xl px-3 text-sm ${
                      active
                        ? 'bg-[#f4d6d3] text-stone-900'
                        : 'text-stone-700 hover:bg-white hover:text-stone-900'
                    }`}
                    onClick={() => {
                      navigate(item.to);
                      onOpenChange(false);
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                );
              })}
            </nav>
          ) : (
            <div className="rounded-2xl bg-white p-4 text-sm text-stone-600 shadow-sm">
              Create a ledger first, then this drawer becomes the home for all ledger-specific pages.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MobileTopBar({ onOpenLedgerMenu }) {
  const location = useLocation();
  const { currentLedger } = useLedger();
  const ledgerRoute = isLedgerPath(location.pathname);

  if (!ledgerRoute) {
    return (
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-stone-200 bg-white/90 px-4 backdrop-blur md:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-stone-900">{getPageLabel(location.pathname)}</p>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-stone-200 bg-white/90 px-4 backdrop-blur md:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-xl text-stone-700"
        onClick={onOpenLedgerMenu}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open ledger menu</span>
      </Button>

      <div className="min-w-0 flex-1 px-3">
        <p className="truncate text-sm font-medium text-stone-900">
          {currentLedger?.name || 'Ledger'}
        </p>
      </div>
    </header>
  );
}

function MobileBottomNav({ onLedgerAction }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { currentLedger } = useLedger();
  const ledgerRoute = isLedgerPath(location.pathname);
  const userLabel = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

  const tabs = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      active: location.pathname === '/',
      onClick: () => navigate('/'),
    },
    {
      key: 'ledger',
      label: 'Ledger',
      icon: BookOpen,
      active: ledgerRoute,
      onClick: onLedgerAction,
    },
    {
      key: 'settings',
      label: userLabel,
      icon: User,
      active: location.pathname === '/settings',
      onClick: () => navigate('/settings'),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-[#f4d6d3]/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="grid grid-cols-3 gap-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <Button
              key={tab.key}
              variant="ghost"
              onClick={tab.onClick}
              className={`h-12 rounded-2xl px-2 ${
                tab.active
                  ? 'bg-[#f28f89] text-stone-950 hover:bg-[#f28f89]'
                  : 'bg-white/80 text-stone-700 hover:bg-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate text-xs">{tab.label}</span>
            </Button>
          );
        })}
      </div>
      {!currentLedger && (
        <p className="mt-2 text-center text-[11px] text-stone-600">
          No ledger selected yet. Tap Ledger to create one.
        </p>
      )}
    </nav>
  );
}

export default function AppShell({ children }) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { currentLedger } = useLedger();
  const [createLedgerOpen, setCreateLedgerOpen] = useState(false);
  const [mobileLedgerMenuOpen, setMobileLedgerMenuOpen] = useState(false);

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  }

  function handleMobileLedgerAction() {
    if (!currentLedger) {
      setCreateLedgerOpen(true);
      return;
    }

    if (isLedgerPath(location.pathname)) {
      setMobileLedgerMenuOpen(true);
      return;
    }

    navigate('/overview');
  }

  const contentPadding = useMemo(() => (
    isMobile ? 'pb-[5.75rem]' : ''
  ), [isMobile]);

  return (
    <SidebarProvider defaultOpen>
      <div className="hidden md:contents">
        <ShellSidebar onCreateLedger={() => setCreateLedgerOpen(true)} onLogout={handleLogout} />
      </div>

      <SidebarInset className={`min-h-screen bg-[#f4efe9] ${contentPadding}`}>
        {isMobile && (
          <>
            <MobileTopBar onOpenLedgerMenu={() => setMobileLedgerMenuOpen(true)} />
            <MobileLedgerDrawer
              open={mobileLedgerMenuOpen}
              onOpenChange={setMobileLedgerMenuOpen}
              onCreateLedger={() => setCreateLedgerOpen(true)}
            />
          </>
        )}

        <div className="min-h-[calc(100vh-3.5rem)]">{children}</div>

        {isMobile && <MobileBottomNav onLedgerAction={handleMobileLedgerAction} />}
      </SidebarInset>

      <CreateLedgerDialog open={createLedgerOpen} onOpenChange={setCreateLedgerOpen} />
    </SidebarProvider>
  );
}
