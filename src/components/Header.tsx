import { Menu, X, User, Shield, ShoppingCart, LayoutDashboard, Heart, Package, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import NotificationDropdown from './NotificationDropdown';
import { getAvatarUrl } from './AvatarUpload';

interface HeaderProps {
  onNavigate: (page: string) => void;
  currentPage: string;
}

export function Header({ onNavigate, currentPage }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const { getCartCount } = useCart();
  const { favorites } = useFavorites();
  const { t } = useLanguage();

  const handleSignOut = async () => {
    await signOut();
    onNavigate('landing');
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center group"
          >
            <img
              src="/nexa-logo.png"
              alt="NEXA"
              className="h-12 w-auto transition-transform group-hover:scale-105"
            />
          </button>

          <nav className="hidden md:flex items-center space-x-1">
            {user ? (
              <>
                <button
                  onClick={() => onNavigate('academy')}
                  className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                    currentPage === 'academy'
                      ? 'bg-gold-500/20 text-gold-400'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t('nav.academy')}
                </button>
                <button
                  onClick={() => onNavigate('professors')}
                  className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                    currentPage === 'professors'
                      ? 'bg-gold-500/20 text-gold-400'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t('nav.professors')}
                </button>
                <button
                  onClick={() => onNavigate('shop')}
                  className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                    currentPage === 'shop'
                      ? 'bg-gold-500/20 text-gold-400'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t('nav.shop')}
                </button>
                {profile?.role !== 'admin' && (
                  <>
                    <button
                      onClick={() => onNavigate('cart')}
                      className={`relative flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                        currentPage === 'cart'
                          ? 'bg-gold-500/20 text-gold-400'
                          : 'text-gray-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {getCartCount() > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] text-white text-xs rounded-full flex items-center justify-center font-bold shadow-glow">
                          {getCartCount()}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => onNavigate('favorites')}
                      className={`relative flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                        currentPage === 'favorites'
                          ? 'bg-gold-500/20 text-gold-400'
                          : 'text-gray-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Heart className="w-4 h-4" />
                      {favorites.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-red-500 to-pink-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-glow">
                          {favorites.length}
                        </span>
                      )}
                    </button>
                    <NotificationDropdown />
                  </>
                )}
                {profile?.role === 'professor' && (
                  <button
                    onClick={() => onNavigate('professor-dashboard')}
                    className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                      currentPage === 'professor-dashboard'
                        ? 'bg-gold-500/20 text-gold-400'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </button>
                )}
                {profile?.role === 'admin' && (
                  <button
                    onClick={() => onNavigate('admin')}
                    className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                      currentPage === 'admin'
                        ? 'bg-gold-500/20 text-gold-400'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    <span>Admin</span>
                  </button>
                )}
                <LanguageSelector />
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                      currentPage === 'account'
                        ? 'bg-gold-500/20 text-gold-400'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={getAvatarUrl(profile.avatar_url) || ''}
                        alt={profile.full_name || 'User'}
                        className="w-6 h-6 rounded-full object-cover border border-gray-700"
                      />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                    <span>{profile?.full_name || t('nav.account')}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-xl shadow-xl py-2 z-50">
                      <button
                        onClick={() => {
                          onNavigate('account');
                          setUserMenuOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        Mon compte
                      </button>
                      {profile?.role !== 'admin' && (
                        <button
                          onClick={() => {
                            onNavigate('my-purchases');
                            setUserMenuOpen(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          Mes achats
                        </button>
                      )}
                      <div className="border-t border-gray-800/50 my-2"></div>
                      <button
                        onClick={handleSignOut}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => onNavigate('academy')}
                  className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                    currentPage === 'academy'
                      ? 'bg-gold-500/20 text-gold-400'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t('nav.academy')}
                </button>
                <button
                  onClick={() => onNavigate('professors')}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  {t('nav.professors')}
                </button>
                <button
                  onClick={() => onNavigate('shop')}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  {t('nav.shop')}
                </button>
                <LanguageSelector />
                <button
                  onClick={() => onNavigate('signin')}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  {t('nav.signIn')}
                </button>
                <button
                  onClick={() => onNavigate('signup')}
                  className="px-6 py-2 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-sm font-semibold rounded-xl hover:shadow-glow transition-all hover:scale-105"
                >
                  {t('nav.getStarted')}
                </button>
              </>
            )}
          </nav>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-300 hover:text-white transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-gray-900/95 backdrop-blur-xl border-t border-gray-800/50">
          <div className="px-4 py-4 space-y-2">
            {user ? (
              <>
                <button
                  onClick={() => {
                    onNavigate('academy');
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  Academy
                </button>
                <button
                  onClick={() => {
                    onNavigate('professors');
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  Professors
                </button>
                <button
                  onClick={() => {
                    onNavigate('shop');
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  Shop
                </button>
                {profile?.role !== 'admin' && (
                  <>
                    <button
                      onClick={() => {
                        onNavigate('cart');
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all relative"
                    >
                      <span className="flex items-center justify-between">
                        Panier
                        {getCartCount() > 0 && (
                          <span className="ml-2 px-2 py-1 bg-gradient-to-br from-[#B8913D] to-[#D4AC5B] text-white text-xs rounded-full font-bold">
                            {getCartCount()}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        onNavigate('favorites');
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all relative"
                    >
                      <span className="flex items-center justify-between">
                        Favoris
                        {favorites.length > 0 && (
                          <span className="ml-2 px-2 py-1 bg-gradient-to-br from-red-500 to-pink-500 text-white text-xs rounded-full font-bold">
                            {favorites.length}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        onNavigate('my-purchases');
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                    >
                      Mes achats
                    </button>
                    <button
                      onClick={() => {
                        onNavigate('notifications');
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                    >
                      Notifications
                    </button>
                  </>
                )}
                {profile?.role === 'professor' && (
                  <button
                    onClick={() => {
                      onNavigate('professor-dashboard');
                      setMobileMenuOpen(false);
                    }}
                    className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                  >
                    Dashboard
                  </button>
                )}
                {profile?.role === 'admin' && (
                  <button
                    onClick={() => {
                      onNavigate('admin');
                      setMobileMenuOpen(false);
                    }}
                    className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                  >
                    Admin
                  </button>
                )}
                <button
                  onClick={() => {
                    onNavigate('account');
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  Mon compte
                </button>
                <button
                  onClick={handleSignOut}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    onNavigate('academy');
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  Academy
                </button>
                <button
                  onClick={() => {
                    onNavigate('professors');
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  Professors
                </button>
                <button
                  onClick={() => {
                    onNavigate('shop');
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  Shop
                </button>
                <button
                  onClick={() => {
                    onNavigate('signin');
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  Connexion
                </button>
                <button
                  onClick={() => {
                    onNavigate('signup');
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full px-4 py-3 bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white text-sm font-semibold rounded-xl hover:shadow-glow transition-all"
                >
                  S'inscrire
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
