import { useState, useEffect } from 'react';
import { User, CreditCard, Settings, CheckCircle, XCircle, Calendar, Users, Globe, Award, Percent, X, AlertTriangle, RefreshCw, GraduationCap, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { useToast } from '../contexts/ToastContext';
import { handlePlatformSubscriptionCheckout } from '../lib/stripe';
import { useSubscription } from '../hooks/useSubscription';
import { AvatarUpload, getAvatarUrl } from '../components/AvatarUpload';
import CancellationModal from '../components/CancellationModal';

interface ProfessorSubscription {
  id: string;
  professor_id: string;
  status: string;
  expires_at: string | null;
  started_at: string | null;
  subscription_created_at: string | null;
  cancel_at_period_end: boolean;
  withdrawal_right_waived: boolean;
  withdrawal_waiver_reason: string | null;
  professor: {
    profiles: {
      full_name: string;
    };
    subscriber_discount_percentage: number;
  };
}

interface AccountProps {
  onNavigate: (page: string) => void;
}

const PLATFORM_SUBSCRIPTION_MONTHLY = 8.99;
const PLATFORM_SUBSCRIPTION_YEARLY = 89;

export function Account({ onNavigate }: AccountProps) {
  const { profile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { cancelSubscription, reactivateSubscription } = useSubscription();
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription' | 'billing'>('profile');
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [professorSubscriptions, setProfessorSubscriptions] = useState<ProfessorSubscription[]>([]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPlanSelectionModal, setShowPlanSelectionModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ type: 'platform' | 'professor'; id?: string; name?: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [professorBio, setProfessorBio] = useState('');
  const [professorSpecialties, setProfessorSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [professorExperience, setProfessorExperience] = useState(0);
  const [professorVideoUrl, setProfessorVideoUrl] = useState('');
  const [savingProfessorInfo, setSavingProfessorInfo] = useState(false);
  const [professorMessage, setProfessorMessage] = useState('');

  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    if (profile && !profileLoaded) {
      setFullName(profile.full_name);
      setAvatarUrl(getAvatarUrl(profile.avatar_url));
      setProfileLoaded(true);
      loadProfessorSubscriptions();
      if (profile.role === 'professor') {
        loadProfessorInfo();
      }
    } else if (profile && profileLoaded) {
      loadProfessorSubscriptions();
    }
  }, [profile]);

  const handleAvatarUpdate = async (url: string) => {
    setAvatarUrl(url);
    await refreshProfile();
  };

  const loadProfessorSubscriptions = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from('professor_subscriptions')
      .select(`
        *,
        professor:professors!inner(
          profiles!inner(full_name),
          subscriber_discount_percentage
        )
      `)
      .eq('user_id', profile.id)
      .eq('status', 'active');

    if (!error && data) {
      setProfessorSubscriptions(data as any);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', profile?.id);

    if (error) {
      setMessage(t('account.profile.errorUpdate'));
    } else {
      setMessage(t('account.profile.successUpdate'));
      await refreshProfile();
    }

    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const loadProfessorInfo = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from('professors')
      .select('*')
      .eq('id', profile.id)
      .maybeSingle();

    if (!error && data) {
      setProfessorBio(data.bio || '');
      setProfessorSpecialties(data.specialties || []);
      setProfessorExperience(data.experience_years || 0);
      setProfessorVideoUrl(data.profile_video_url || '');
    }
  };

  const handleAddSpecialty = () => {
    const trimmedSpecialty = newSpecialty.trim();
    if (trimmedSpecialty && !professorSpecialties.includes(trimmedSpecialty)) {
      setProfessorSpecialties([...professorSpecialties, trimmedSpecialty]);
      setNewSpecialty('');
    }
  };

  const handleRemoveSpecialty = (specialtyToRemove: string) => {
    setProfessorSpecialties(professorSpecialties.filter(s => s !== specialtyToRemove));
  };

  const handleUpdateProfessorInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfessorInfo(true);
    setProfessorMessage('');

    const { error } = await supabase
      .from('professors')
      .upsert({
        id: profile?.id,
        bio: professorBio,
        specialties: professorSpecialties,
        experience_years: professorExperience,
        profile_video_url: professorVideoUrl,
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.error('Error updating professor info:', error);
      setProfessorMessage('Error updating professor information');
      showToast('Error updating professor information', 'error');
    } else {
      setProfessorMessage('Professor information updated successfully');
      showToast('Professor information updated successfully', 'success');
    }

    setSavingProfessorInfo(false);
    setTimeout(() => setProfessorMessage(''), 3000);
  };

  const hasActiveSubscription = profile?.platform_subscription_status === 'active' &&
    profile?.platform_subscription_expires_at &&
    new Date(profile.platform_subscription_expires_at) > new Date();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleOpenCancelModal = (type: 'platform' | 'professor', id?: string, name?: string) => {
    setCancelTarget({ type, id, name });
    setShowCancelModal(true);
  };

  const handleCloseCancelModal = () => {
    setShowCancelModal(false);
    setCancelTarget(null);
  };

  const isWithinWithdrawalPeriod = (createdAt: string | null): boolean => {
    if (!createdAt) return false;
    const createdDate = new Date(createdAt);
    const daysSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation <= 14;
  };

  const getPlatformSubscriptionCreatedAt = (): string | null => {
    return profile?.platform_subscription_created_at || profile?.created_at || null;
  };

  const getProfessorSubscriptionCreatedAt = (subscriptionId: string): string | null => {
    const sub = professorSubscriptions.find(s => s.id === subscriptionId);
    return sub?.subscription_created_at || sub?.started_at || null;
  };

  const getPlatformWithdrawalStatus = () => {
    return {
      waived: profile?.platform_withdrawal_right_waived || false,
      reason: profile?.platform_withdrawal_waiver_reason || undefined
    };
  };

  const getProfessorWithdrawalStatus = (subscriptionId: string) => {
    const sub = professorSubscriptions.find(s => s.id === subscriptionId);
    return {
      waived: sub?.withdrawal_right_waived || false,
      reason: sub?.withdrawal_waiver_reason || undefined
    };
  };

  const handleConfirmCancel = async (reason: string, feedback: string, requestRefund: boolean) => {
    if (!cancelTarget) return;

    setCancelling(true);
    try {
      if (cancelTarget.type === 'platform') {
        await cancelSubscription('platform', undefined, reason, feedback, requestRefund);
        if (requestRefund) {
          showToast('Refund request submitted successfully. You will receive your refund within 5-10 business days.', 'success');
        } else {
          showToast('Your subscription will be cancelled at the end of the billing period', 'success');
        }
      } else if (cancelTarget.type === 'professor' && cancelTarget.id) {
        await cancelSubscription('professor', cancelTarget.id, reason, feedback, requestRefund);
        if (requestRefund) {
          showToast('Refund request submitted successfully. You will receive your refund within 5-10 business days.', 'success');
        } else {
          showToast('Professor subscription will be cancelled at the end of the billing period', 'success');
        }
        await loadProfessorSubscriptions();
      }

      await refreshProfile();
      handleCloseCancelModal();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      showToast(error instanceof Error ? error.message : 'Error cancelling subscription', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivateSubscription = async (subscriptionType: 'platform' | 'professor', professorId?: string) => {
    try {
      await reactivateSubscription(subscriptionType, professorId);
      showToast('Subscription reactivated successfully', 'success');
      await refreshProfile();
      if (subscriptionType === 'professor') {
        await loadProfessorSubscriptions();
      }
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      showToast(error instanceof Error ? error.message : 'Error reactivating subscription', 'error');
    }
  };

  const handleSubscribeToPlatform = () => {
    setShowPlanSelectionModal(true);
  };

  const handlePlanSelection = async (planType: 'monthly' | 'yearly') => {
    try {
      setShowPlanSelectionModal(false);
      setCheckoutLoading(true);
      const price = planType === 'monthly' ? PLATFORM_SUBSCRIPTION_MONTHLY : PLATFORM_SUBSCRIPTION_YEARLY;
      await handlePlatformSubscriptionCheckout(price, planType);
    } catch (error) {
      console.error('Error starting checkout:', error);
      setCheckoutLoading(false);
      showToast(error instanceof Error ? error.message : 'Error starting checkout', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-16 sm:pt-18 lg:pt-14 pb-8 sm:pb-10 lg:pb-6 relative">
      <BackgroundDecor />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="relative mb-6 sm:mb-7 lg:mb-5">
          <div className="absolute -top-10 right-0 w-64 h-64 bg-[#B8913D] opacity-5 rounded-full blur-3xl pointer-events-none"></div>
          <h1 className="text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-light text-white relative">
            {t('account.header.title')}
          </h1>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl sm:rounded-2xl lg:rounded-xl overflow-hidden border border-gray-700/50">
          <div className="border-b border-gray-700/50 bg-gray-800/50">
            <nav className="flex space-x-4 sm:space-x-8 lg:space-x-6 px-4 sm:px-6 lg:px-4 overflow-x-auto">
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-3 sm:py-4 lg:py-3 border-b-2 font-medium text-xs sm:text-sm lg:text-xs whitespace-nowrap transition-all ${
                  activeTab === 'profile'
                    ? 'border-[#B8913D] text-[#B8913D]'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                }`}
              >
                <User className="w-3 h-3 sm:w-4 sm:h-4 lg:w-3 lg:h-3 inline mr-1.5 sm:mr-2 lg:mr-1.5" />
                {t('account.tabs.profile')}
              </button>
              <button
                onClick={() => setActiveTab('subscription')}
                className={`py-3 sm:py-4 lg:py-3 border-b-2 font-medium text-xs sm:text-sm lg:text-xs whitespace-nowrap transition-all ${
                  activeTab === 'subscription'
                    ? 'border-[#B8913D] text-[#B8913D]'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                }`}
              >
                <Settings className="w-3 h-3 sm:w-4 sm:h-4 lg:w-3 lg:h-3 inline mr-1.5 sm:mr-2 lg:mr-1.5" />
                {t('account.tabs.subscription')}
              </button>
              <button
                onClick={() => setActiveTab('billing')}
                className={`py-3 sm:py-4 lg:py-3 border-b-2 font-medium text-xs sm:text-sm lg:text-xs whitespace-nowrap transition-all ${
                  activeTab === 'billing'
                    ? 'border-[#B8913D] text-[#B8913D]'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                }`}
              >
                <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 lg:w-3 lg:h-3 inline mr-1.5 sm:mr-2 lg:mr-1.5" />
                {t('account.tabs.billing')}
              </button>
            </nav>
          </div>

          <div className="p-4 sm:p-6 lg:p-5">
            {activeTab === 'profile' && (
              <div>
                <h2 className="text-lg sm:text-xl lg:text-lg font-medium text-white mb-4 sm:mb-6 lg:mb-4">{t('account.profile.title')}</h2>

                {profile && (
                  <div className="mb-8">
                    <AvatarUpload
                      userId={profile.id}
                      currentAvatarUrl={avatarUrl}
                      onAvatarUpdate={handleAvatarUpdate}
                    />
                  </div>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('account.profile.email')}
                    </label>
                    <input
                      type="email"
                      value={profile?.email || ''}
                      disabled
                      className="w-full px-4 py-3 border border-gray-700 rounded-lg bg-gray-900 text-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('account.profile.fullName')}
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  {profile?.role === 'professor' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {t('account.profile.role')}
                      </label>
                      <input
                        type="text"
                        value={profile?.role || 'student'}
                        disabled
                        className="w-full px-4 py-3 border border-gray-700 rounded-lg bg-gray-900 text-gray-400 capitalize"
                      />
                    </div>
                  )}

                  {message && (
                    <div className={`p-4 rounded-lg ${
                      message.includes('success')
                        ? 'bg-green-50 text-green-800'
                        : 'bg-red-50 text-red-800'
                    }`}>
                      {message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-3 bg-[#B8913D] text-white font-medium rounded-lg hover:bg-[#A07F35] transition-colors disabled:opacity-50"
                  >
                    {saving ? t('account.profile.saving') : t('account.profile.saveButton')}
                  </button>
                </form>

                {profile?.role === 'professor' && (
                  <div className="mt-12 pt-12 border-t border-gray-700">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#B8913D] to-[#A07F35] rounded-lg flex items-center justify-center">
                        <GraduationCap className="w-6 h-6 text-white" />
                      </div>
                      <h2 className="text-xl font-medium text-white">Professor Information</h2>
                    </div>

                    <form onSubmit={handleUpdateProfessorInfo} className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Biography
                        </label>
                        <textarea
                          value={professorBio}
                          onChange={(e) => setProfessorBio(e.target.value)}
                          rows={6}
                          placeholder="Tell students about yourself, your experience, and teaching style..."
                          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Specialties
                        </label>
                        <div className="flex space-x-2 mb-3">
                          <input
                            type="text"
                            value={newSpecialty}
                            onChange={(e) => setNewSpecialty(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddSpecialty();
                              }
                            }}
                            placeholder="Add a specialty (e.g., Kizomba, Semba)"
                            className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={handleAddSpecialty}
                            className="px-4 py-3 bg-[#B8913D] text-white rounded-lg hover:bg-[#A07F35] transition-colors"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                        {professorSpecialties.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {professorSpecialties.map((specialty, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center space-x-2 px-3 py-1.5 bg-[#B8913D]/20 text-[#D4AC5B] rounded-lg text-sm border border-[#B8913D]/30"
                              >
                                <span>{specialty}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSpecialty(specialty)}
                                  className="hover:text-white transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Years of Experience
                        </label>
                        <input
                          type="number"
                          value={professorExperience}
                          onChange={(e) => setProfessorExperience(parseInt(e.target.value) || 0)}
                          min="0"
                          max="50"
                          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Profile Video URL (Optional)
                        </label>
                        <input
                          type="url"
                          value={professorVideoUrl}
                          onChange={(e) => setProfessorVideoUrl(e.target.value)}
                          placeholder="https://example.com/my-intro-video"
                          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Add a video introducing yourself to potential students
                        </p>
                      </div>

                      {professorMessage && (
                        <div className={`p-4 rounded-lg ${
                          professorMessage.includes('success')
                            ? 'bg-green-900/30 text-green-400 border border-green-500/50'
                            : 'bg-red-900/30 text-red-400 border border-red-500/50'
                        }`}>
                          {professorMessage}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={savingProfessorInfo}
                        className="px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white font-medium rounded-lg hover:shadow-lg hover:shadow-[#B8913D]/50 transition-all disabled:opacity-50"
                      >
                        {savingProfessorInfo ? 'Saving...' : 'Save Professor Information'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'subscription' && (
              <div>
                <h2 className="text-xl font-medium text-white mb-6">{t('account.subscription.title')}</h2>

                <div className="space-y-6">
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-[#B8913D] border-opacity-30">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#B8913D] to-[#A07F35] rounded-xl flex items-center justify-center">
                          <Globe className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-medium text-white mb-1">{t('account.subscription.platformTitle')}</h3>
                          <div className="flex items-center space-x-2 mb-3">
                            {hasActiveSubscription ? (
                              profile.subscription_cancel_at_period_end ? (
                                <>
                                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                                  <span className="text-yellow-400 font-medium">Résiliation programmée</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                                  <span className="text-green-600 font-medium">{t('account.subscription.active')}</span>
                                </>
                              )
                            ) : (
                              <>
                                <XCircle className="w-5 h-5 text-gray-400" />
                                <span className="text-gray-400 font-medium">{t('account.subscription.inactive')}</span>
                              </>
                            )}
                          </div>
                          {hasActiveSubscription && (
                            <div className="text-sm text-gray-400 flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {t('account.subscription.expiresOn')} {formatDate(profile.platform_subscription_expires_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {hasActiveSubscription ? (
                      <div className="mt-4">
                        {profile.subscription_cancel_at_period_end && (
                          <div className="mb-4 p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg flex items-start space-x-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm text-yellow-200 mb-2">
                                Your subscription will be cancelled on {formatDate(profile.platform_subscription_expires_at)}
                              </p>
                              <button
                                onClick={() => handleReactivateSubscription('platform')}
                                className="flex items-center space-x-2 text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
                              >
                                <RefreshCw className="w-4 h-4" />
                                <span>Reactivate Subscription</span>
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="space-y-2 mb-4">
                          <div className="flex items-start space-x-2 text-sm text-gray-300">
                            <Award className="w-4 h-4 text-[#B8913D] mt-0.5 flex-shrink-0" />
                            <span>{t('account.subscription.benefit1')}</span>
                          </div>
                          <div className="flex items-start space-x-2 text-sm text-gray-300">
                            <Award className="w-4 h-4 text-[#B8913D] mt-0.5 flex-shrink-0" />
                            <span>{t('account.subscription.benefit2')}</span>
                          </div>
                          <div className="flex items-start space-x-2 text-sm text-gray-300">
                            <Award className="w-4 h-4 text-[#B8913D] mt-0.5 flex-shrink-0" />
                            <span>{t('account.subscription.benefit3')}</span>
                          </div>
                        </div>
                        {!profile.subscription_cancel_at_period_end && (
                          <button
                            onClick={() => handleOpenCancelModal('platform')}
                            className="w-full px-6 py-3 bg-red-900/30 border border-red-500/50 text-red-400 font-medium rounded-lg hover:bg-red-900/50 transition-colors"
                          >
                            {t('account.subscription.cancelSubscription')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4">
                        <ul className="space-y-2 mb-4">
                          <li className="flex items-start space-x-2 text-sm text-gray-300">
                            <Award className="w-4 h-4 text-[#B8913D] mt-0.5 flex-shrink-0" />
                            <span>{t('account.subscription.benefit1')}</span>
                          </li>
                          <li className="flex items-start space-x-2 text-sm text-gray-300">
                            <Award className="w-4 h-4 text-[#B8913D] mt-0.5 flex-shrink-0" />
                            <span>{t('account.subscription.benefit2')}</span>
                          </li>
                          <li className="flex items-start space-x-2 text-sm text-gray-300">
                            <Award className="w-4 h-4 text-[#B8913D] mt-0.5 flex-shrink-0" />
                            <span>{t('account.subscription.benefit3')}</span>
                          </li>
                        </ul>
                        <button
                          onClick={handleSubscribeToPlatform}
                          className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white font-medium rounded-lg hover:shadow-xl transition-all"
                        >
                          {t('account.subscription.subscribeToPlatform')}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-[#B8913D] border-opacity-30">
                    <div className="flex items-start space-x-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white mb-1">{t('account.subscription.professorsTitle')}</h3>
                        <p className="text-sm text-gray-400">
                          {professorSubscriptions.length > 0
                            ? `${t('account.subscription.subscribedTo')} ${professorSubscriptions.length} ${professorSubscriptions.length > 1 ? t('account.subscription.professorPlural') : t('account.subscription.professorSingular')}`
                            : t('account.subscription.noProfessors')
                          }
                        </p>
                      </div>
                    </div>

                    {professorSubscriptions.length > 0 ? (
                      <div className="space-y-3">
                        {professorSubscriptions.map((sub) => (
                          <div key={sub.id} className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-gray-700/50">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-medium text-white">{sub.professor.profiles.full_name}</h4>
                                <div className="flex items-center space-x-2 mt-1">
                                  {sub.cancel_at_period_end ? (
                                    <>
                                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                      <span className="text-sm text-yellow-400">Résiliation programmée</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                      <span className="text-sm text-green-600">{t('account.subscription.activeSubscription')}</span>
                                    </>
                                  )}
                                </div>
                                {sub.expires_at && (
                                  <div className="text-xs text-gray-400 mt-1 flex items-center">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {t('account.subscription.expiresOn')} {formatDate(sub.expires_at)}
                                  </div>
                                )}
                              </div>
                              {sub.professor.subscriber_discount_percentage > 0 && (
                                <div className="bg-green-900 bg-opacity-40 px-3 py-1 rounded-lg flex items-center space-x-1 border border-green-600 border-opacity-40">
                                  <Percent className="w-4 h-4 text-green-400" />
                                  <span className="text-sm font-medium text-green-400">
                                    -{sub.professor.subscriber_discount_percentage}{t('account.subscription.discountSuffix')}
                                  </span>
                                </div>
                              )}
                            </div>
                            {sub.professor.subscriber_discount_percentage > 0 && (
                              <div className="mb-3 pb-3 border-b border-gray-700/50">
                                <p className="text-xs text-gray-400">
                                  <Award className="w-3 h-3 inline mr-1 text-[#B8913D]" />
                                  {t('account.subscription.discountMessage')} {sub.professor.subscriber_discount_percentage}{t('account.subscription.discountSuffix')}
                                </p>
                              </div>
                            )}
                            {sub.cancel_at_period_end ? (
                              <div className="space-y-2">
                                <div className="p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg flex items-start space-x-2">
                                  <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                                  <p className="text-xs text-yellow-200">
                                    Subscription will be cancelled on {formatDate(sub.expires_at)}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleReactivateSubscription('professor', sub.professor_id)}
                                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-700/50 border border-gray-600 text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  <span>Reactivate Subscription</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenCancelModal('professor', sub.id, sub.professor.profiles.full_name)}
                                className="w-full px-4 py-2 bg-red-900/30 border border-red-500/50 text-red-400 text-sm font-medium rounded-lg hover:bg-red-900/50 transition-colors"
                              >
                                {t('account.subscription.cancelProfessorSubscription')}
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => onNavigate('professors')}
                          className="w-full px-6 py-3 bg-gray-800/50 border border-gray-700 text-gray-300 font-medium rounded-lg hover:bg-gray-700/70 transition-colors"
                        >
                          {t('account.subscription.discoverMore')}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-400 mb-4">
                          {t('account.subscription.subscribeBenefitsIntro')}
                        </p>
                        <ul className="space-y-2 mb-4">
                          <li className="flex items-start space-x-2 text-sm text-gray-300">
                            <Award className="w-4 h-4 text-[#B8913D] mt-0.5 flex-shrink-0" />
                            <span>{t('account.subscription.subscribeBenefit1')}</span>
                          </li>
                          <li className="flex items-start space-x-2 text-sm text-gray-300">
                            <Percent className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            <span>{t('account.subscription.subscribeBenefit2')}</span>
                          </li>
                          <li className="flex items-start space-x-2 text-sm text-gray-300">
                            <Award className="w-4 h-4 text-[#B8913D] mt-0.5 flex-shrink-0" />
                            <span>{t('account.subscription.subscribeBenefit3')}</span>
                          </li>
                        </ul>
                        <button
                          onClick={() => onNavigate('professors')}
                          className="w-full px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white font-medium rounded-lg hover:shadow-xl transition-all"
                        >
                          {t('account.subscription.discoverProfessors')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div>
                <h2 className="text-xl font-medium text-white mb-6">{t('account.billing.title')}</h2>

                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 text-center border border-[#B8913D] border-opacity-30">
                  <CreditCard className="w-12 h-12 text-[#B8913D] mx-auto mb-4" />
                  <h3 className="font-medium text-white mb-2">{t('account.billing.paymentMethod')}</h3>
                  <p className="text-sm text-gray-300 mb-4">
                    {t('account.billing.stripeMessage')}
                  </p>
                  <button
                    disabled
                    className="px-6 py-2 bg-gray-700 text-gray-400 font-medium rounded-lg cursor-not-allowed"
                  >
                    {t('account.billing.stripeRequired')}
                  </button>
                </div>

                <div className="mt-6">
                  <h3 className="font-medium text-white mb-4">{t('account.billing.history')}</h3>
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 text-center text-gray-300 text-sm border border-[#B8913D] border-opacity-30">
                    {t('account.billing.noHistory')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPlanSelectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl max-w-4xl w-full border border-gray-700/50 overflow-hidden max-h-[95vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4 sm:mb-6">
                <div>
                  <h3 className="text-lg sm:text-2xl font-medium text-white mb-1 sm:mb-2">
                    {t('account.subscription.modal.chooseYourPlan')}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400">
                    {t('account.subscription.modal.accessAllPremium')}
                  </p>
                </div>
                <button
                  onClick={() => setShowPlanSelectionModal(false)}
                  className="text-gray-400 hover:text-white transition-colors ml-3 flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-6">
                <div
                  onClick={() => handlePlanSelection('monthly')}
                  className="bg-gray-900/50 rounded-xl p-3 sm:p-6 border border-gray-700/50 hover:border-[#B8913D]/50 transition-all cursor-pointer group hover:transform hover:scale-105"
                >
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <div className="min-w-0">
                      <h4 className="text-sm sm:text-xl font-medium text-white mb-0.5 sm:mb-1 truncate">{t('account.subscription.modal.monthly')}</h4>
                      <p className="text-xs text-gray-400 hidden sm:block">{t('account.subscription.modal.flexibleCommitment')}</p>
                    </div>
                    <Calendar className="w-5 h-5 sm:w-8 sm:h-8 text-[#B8913D] flex-shrink-0 ml-1" />
                  </div>

                  <div className="mb-3 sm:mb-6">
                    <div className="flex items-baseline flex-wrap gap-x-1">
                      <span className="text-2xl sm:text-4xl font-bold text-white">{PLATFORM_SUBSCRIPTION_MONTHLY}€</span>
                      <span className="text-xs sm:text-sm text-gray-400">{t('account.subscription.modal.perMonth')}</span>
                    </div>
                  </div>

                  <ul className="space-y-1.5 sm:space-y-3 mb-3 sm:mb-6">
                    <li className="flex items-start space-x-1.5 sm:space-x-2 text-gray-300">
                      <CheckCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#B8913D] mt-0.5 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{t('account.subscription.modal.benefit1')}</span>
                    </li>
                    <li className="flex items-start space-x-1.5 sm:space-x-2 text-gray-300">
                      <CheckCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#B8913D] mt-0.5 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{t('account.subscription.modal.benefit2')}</span>
                    </li>
                    <li className="flex items-start space-x-1.5 sm:space-x-2 text-gray-300">
                      <CheckCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#B8913D] mt-0.5 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{t('account.subscription.modal.benefit3')}</span>
                    </li>
                  </ul>

                  <button className="w-full px-2 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-[#B8913D] to-[#9A7B2F] text-white text-xs sm:text-base font-medium rounded-lg hover:from-[#9A7B2F] hover:to-[#B8913D] transition-all group-hover:shadow-lg">
                    {t('account.subscription.modal.chooseMonthly')}
                  </button>
                </div>

                <div
                  onClick={() => handlePlanSelection('yearly')}
                  className="bg-gradient-to-br from-[#B8913D]/20 to-[#9A7B2F]/10 rounded-xl p-3 sm:p-6 border-2 border-[#B8913D] hover:border-[#B8913D] transition-all cursor-pointer relative group hover:transform hover:scale-105"
                >
                  <div className="absolute -top-2.5 -right-2 sm:-top-3 sm:-right-3 bg-gradient-to-r from-[#B8913D] to-[#9A7B2F] text-white text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                    {t('account.subscription.modal.savePercent', { percent: '17' })}
                  </div>

                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <div className="min-w-0">
                      <h4 className="text-sm sm:text-xl font-medium text-white mb-0.5 sm:mb-1 truncate">{t('account.subscription.modal.annual')}</h4>
                      <p className="text-xs text-[#B8913D]">{t('account.subscription.modal.bestOffer')}</p>
                    </div>
                    <Award className="w-5 h-5 sm:w-8 sm:h-8 text-[#B8913D] flex-shrink-0 ml-1" />
                  </div>

                  <div className="mb-3 sm:mb-6">
                    <div className="flex items-baseline flex-wrap gap-x-1 mb-0.5 sm:mb-1">
                      <span className="text-2xl sm:text-4xl font-bold text-white">{PLATFORM_SUBSCRIPTION_YEARLY}€</span>
                      <span className="text-xs sm:text-sm text-gray-400">{t('account.subscription.modal.perYear')}</span>
                    </div>
                    <p className="text-xs text-[#B8913D]">{t('account.subscription.modal.orPerMonth', { price: '7.42' })}</p>
                  </div>

                  <ul className="space-y-1.5 sm:space-y-3 mb-3 sm:mb-6">
                    <li className="flex items-start space-x-1.5 sm:space-x-2 text-gray-300">
                      <CheckCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#B8913D] mt-0.5 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{t('account.subscription.modal.benefit1')}</span>
                    </li>
                    <li className="flex items-start space-x-1.5 sm:space-x-2 text-gray-300">
                      <CheckCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#B8913D] mt-0.5 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{t('account.subscription.modal.benefit2')}</span>
                    </li>
                    <li className="flex items-start space-x-1.5 sm:space-x-2 text-gray-300">
                      <CheckCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#B8913D] mt-0.5 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{t('account.subscription.modal.benefit3')}</span>
                    </li>
                  </ul>

                  <button className="w-full px-2 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-[#B8913D] to-[#9A7B2F] text-white text-xs sm:text-base font-medium rounded-lg hover:from-[#9A7B2F] hover:to-[#B8913D] transition-all shadow-lg group-hover:shadow-xl">
                    {t('account.subscription.modal.chooseAnnual')}
                  </button>
                </div>
              </div>

              <p className="text-center text-xs sm:text-sm text-gray-400 mt-4 sm:mt-6">
                {t('account.subscription.modal.securePayment')}
              </p>
            </div>
          </div>
        </div>
      )}

      {checkoutLoading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700/50 flex flex-col items-center space-y-5 max-w-xs w-full mx-4">
            <div className="w-16 h-16 rounded-full border-4 border-gray-700 border-t-[#B8913D] animate-spin" />
            <div className="text-center">
              <p className="text-white font-medium text-lg mb-1">Redirection en cours...</p>
              <p className="text-gray-400 text-sm">Vous allez être redirigé vers la page de paiement sécurisé</p>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <svg className="w-4 h-4 text-[#B8913D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Paiement sécurisé via Stripe</span>
            </div>
          </div>
        </div>
      )}

      <CancellationModal
        isOpen={showCancelModal}
        onClose={handleCloseCancelModal}
        onConfirm={handleConfirmCancel}
        subscriptionType={cancelTarget?.type || 'platform'}
        professorName={cancelTarget?.name}
        isWithinWithdrawalPeriod={
          cancelTarget?.type === 'platform'
            ? isWithinWithdrawalPeriod(getPlatformSubscriptionCreatedAt())
            : cancelTarget?.id
            ? isWithinWithdrawalPeriod(getProfessorSubscriptionCreatedAt(cancelTarget.id))
            : false
        }
        subscriptionStartDate={
          cancelTarget?.type === 'platform'
            ? formatDate(getPlatformSubscriptionCreatedAt())
            : cancelTarget?.id
            ? formatDate(getProfessorSubscriptionCreatedAt(cancelTarget.id))
            : 'N/A'
        }
        withdrawalRightWaived={
          cancelTarget?.type === 'platform'
            ? getPlatformWithdrawalStatus().waived
            : cancelTarget?.id
            ? getProfessorWithdrawalStatus(cancelTarget.id).waived
            : false
        }
        withdrawalWaiverReason={
          cancelTarget?.type === 'platform'
            ? getPlatformWithdrawalStatus().reason
            : cancelTarget?.id
            ? getProfessorWithdrawalStatus(cancelTarget.id).reason
            : undefined
        }
      />
    </div>
  );
}
