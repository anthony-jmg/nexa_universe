import { useState } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';

interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, feedback: string, requestRefund: boolean) => void;
  subscriptionType: 'platform' | 'professor';
  professorName?: string;
  isWithinWithdrawalPeriod: boolean;
  subscriptionStartDate?: string;
  withdrawalRightWaived?: boolean;
  withdrawalWaiverReason?: string;
}

const cancellationReasons = {
  platform: [
    { value: 'too_expensive', label: 'Too expensive' },
    { value: 'not_using', label: 'Not using the platform enough' },
    { value: 'found_alternative', label: 'Found an alternative platform' },
    { value: 'missing_features', label: 'Missing features I need' },
    { value: 'technical_issues', label: 'Technical issues' },
    { value: 'content_quality', label: 'Content quality below expectations' },
    { value: 'temporary', label: 'Taking a temporary break' },
    { value: 'other', label: 'Other reason' },
  ],
  professor: [
    { value: 'switching_professor', label: 'Switching to a different professor' },
    { value: 'too_expensive', label: 'Too expensive' },
    { value: 'completed_learning', label: 'Completed my learning goals' },
    { value: 'not_my_style', label: 'Teaching style not for me' },
    { value: 'not_using', label: 'Not using enough' },
    { value: 'content_pace', label: 'Content pace not suitable' },
    { value: 'temporary', label: 'Taking a temporary break' },
    { value: 'other', label: 'Other reason' },
  ],
};

export default function CancellationModal({
  isOpen,
  onClose,
  onConfirm,
  subscriptionType,
  professorName,
  isWithinWithdrawalPeriod,
  subscriptionStartDate,
  withdrawalRightWaived = false,
  withdrawalWaiverReason,
}: CancellationModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [requestRefund, setRequestRefund] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const reasons = cancellationReasons[subscriptionType];
  const subscriptionName = subscriptionType === 'platform'
    ? 'Platform Subscription'
    : `${professorName}'s Subscription`;

  const getWaiverReasonText = (reason?: string): string => {
    switch (reason) {
      case 'used_discount_on_program_purchase':
        return 'You used your subscriber discount to purchase a program';
      case 'used_discount_on_video_purchase':
        return 'You used your subscriber discount to purchase a video';
      default:
        return 'You have used benefits from this subscription';
    }
  };

  const canRequestRefund = isWithinWithdrawalPeriod && !withdrawalRightWaived;

  const handleSubmit = async () => {
    if (!selectedReason) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(selectedReason, feedback, requestRefund && canRequestRefund);
      onClose();
    } catch (error) {
      console.error('Error submitting cancellation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason('');
      setFeedback('');
      setRequestRefund(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">
            Cancel {subscriptionName}
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {canRequestRefund && (
            <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-400 mb-1">14-Day Withdrawal Period</h3>
                  <p className="text-sm text-green-200 mb-3">
                    You subscribed on {subscriptionStartDate}. Since it's been less than 14 days, you're eligible for a full refund.
                  </p>
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requestRefund}
                      onChange={(e) => setRequestRefund(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-gray-600 text-green-500 focus:ring-green-500 focus:ring-offset-gray-900"
                    />
                    <span className="text-sm text-green-200">
                      I want to request a full refund (will be processed within 5-10 business days)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {withdrawalRightWaived && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-400 mb-1">Withdrawal Right Waived</h3>
                  <p className="text-sm text-red-200 mb-2">
                    {getWaiverReasonText(withdrawalWaiverReason)}. According to EU consumer law (Directive 2011/83/EU Article 16(m)), using subscription benefits during the withdrawal period waives your right to a refund.
                  </p>
                  <p className="text-sm text-red-200">
                    Your subscription will remain active until the end of the current billing period, but no refund is available.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!canRequestRefund && !withdrawalRightWaived && (
            <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-400 mb-1">Cancellation Notice</h3>
                  <p className="text-sm text-yellow-200">
                    Your subscription will remain active until the end of your current billing period. You won't be charged for future periods, and you'll continue to have access until expiration.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Help us improve: Why are you cancelling? <span className="text-red-400">*</span>
            </label>
            <div className="space-y-2">
              {reasons.map((reason) => (
                <label
                  key={reason.value}
                  className="flex items-start space-x-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-700"
                >
                  <input
                    type="radio"
                    name="cancellation-reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="mt-0.5 w-4 h-4 text-[#B8913D] focus:ring-[#B8913D] focus:ring-offset-gray-900"
                  />
                  <span className="text-gray-300">{reason.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Additional feedback (optional)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              placeholder="Tell us more about your experience and how we could improve..."
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#B8913D] focus:border-transparent outline-none transition-all resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Your feedback helps us improve our platform and better serve our community.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-700">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-6 py-3 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
            >
              Keep Subscription
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedReason || isSubmitting}
              className="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Processing...' : requestRefund && canRequestRefund ? 'Cancel & Request Refund' : 'Confirm Cancellation'}
            </button>
          </div>

          {(!canRequestRefund || withdrawalRightWaived) && (
            <p className="text-xs text-gray-400 text-center">
              {withdrawalRightWaived
                ? 'You waived your withdrawal right by using subscription benefits. '
                : 'The 14-day withdrawal period has passed. '
              }
              For more information, see our{' '}
              <button
                onClick={() => window.open('/refund-policy', '_blank')}
                className="text-[#B8913D] hover:text-[#D4AC5B] underline"
              >
                Refund Policy
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
