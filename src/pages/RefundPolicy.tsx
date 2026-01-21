import { ArrowLeft, AlertCircle, CheckCircle, Clock, Euro, XCircle } from 'lucide-react';
import { BackgroundDecor } from '../components/BackgroundDecor';

interface RefundPolicyProps {
  onNavigate: (page: string) => void;
}

export default function RefundPolicy({ onNavigate }: RefundPolicyProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <BackgroundDecor />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </button>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-[#B8913D]/30">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#D4AC5B] to-[#B8913D] bg-clip-text text-transparent">
            Refund Policy
          </h1>
          <p className="text-gray-400 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="space-y-8 text-gray-300">
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-xl p-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">EU Consumer Rights</h3>
                  <p>
                    In compliance with EU Directive 2011/83/EU on consumer rights, we offer a 14-day withdrawal period for all subscription purchases. This gives you the right to cancel your subscription and receive a full refund within 14 days of purchase, provided you have not used any subscription benefits.
                  </p>
                </div>
              </div>
            </div>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. 14-Day Withdrawal Period</h2>

              <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 border border-green-500/30 rounded-xl p-6 mb-6">
                <div className="flex items-start space-x-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Full Refund Guarantee</h3>
                    <p className="mb-3">
                      If you cancel your subscription within 14 days of your initial purchase AND have not used any subscription benefits, you will receive a <strong>100% refund</strong> of the subscription fee.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm ml-9">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-green-400" />
                    <span>Period starts: Date of purchase</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-green-400" />
                    <span>Period ends: 14 days after purchase</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Euro className="w-4 h-4 text-green-400" />
                    <span>Refund amount: Full subscription price (if no benefits used)</span>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mb-3">How to Request a Withdrawal Refund:</h3>
              <ol className="list-decimal list-inside space-y-3 ml-4">
                <li>Go to your Account page</li>
                <li>Navigate to the Subscription tab</li>
                <li>Click "Cancel Subscription" on the subscription you wish to cancel</li>
                <li>Select "Request Refund (Within 14 Days)" as your cancellation reason</li>
                <li>Submit your request</li>
              </ol>
              <p className="mt-4 text-sm text-gray-400">
                Refunds are processed within 5-10 business days to your original payment method.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Withdrawal Right Waiver (Important!)</h2>

              <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-6 mb-4">
                <div className="flex items-start space-x-3">
                  <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Using Benefits Waives Your Right to Refund</h3>
                    <p className="mb-3">
                      According to <strong>EU Directive 2011/83/EU Article 16(m)</strong>, if you begin using the benefits of your subscription during the 14-day withdrawal period, you waive your right to withdraw and receive a refund.
                    </p>
                    <p className="text-sm text-red-200">
                      This is automatic anti-abuse protection to prevent users from subscribing, using discounts, and then immediately requesting a refund.
                    </p>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mb-3">What Counts as Using Benefits?</h3>
              <div className="space-y-3 ml-4">
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-white mb-2">Platform Subscription:</h4>
                  <ul className="space-y-1 text-sm ml-4 list-disc">
                    <li>Using your subscriber discount on ANY purchase (videos, programs, products)</li>
                    <li>Accessing platform-exclusive content</li>
                  </ul>
                </div>

                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-white mb-2">Professor Subscription:</h4>
                  <ul className="space-y-1 text-sm ml-4 list-disc">
                    <li>Using the professor's subscriber discount on ANY purchase</li>
                    <li>Accessing professor-exclusive content</li>
                  </ul>
                </div>
              </div>

              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-xl p-4 mt-4">
                <p className="text-sm text-yellow-200">
                  <strong>Important:</strong> Once you use any subscription benefit, the withdrawal right is automatically waived and NO refund will be available, even within the 14-day period. Your subscription will continue until the end of the billing period.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Cancellation After 14 Days</h2>

              <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 mb-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">No Refund, Access Until Period End</h3>
                    <p>
                      If you cancel your subscription after the 14-day withdrawal period, you will <strong>not receive a refund</strong>. However, you will retain full access to your subscription benefits until the end of your current billing period.
                    </p>
                  </div>
                </div>
              </div>

              <p className="mb-4">When you cancel after 14 days:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>No refund is issued for the current billing period</li>
                <li>Your subscription remains active until the expiration date</li>
                <li>You will not be charged for subsequent periods</li>
                <li>You can continue to access all content and features until expiration</li>
                <li>You can reactivate your subscription before it expires</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Different Types of Purchases</h2>

              <div className="space-y-4">
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">Platform Subscription</h3>
                  <ul className="space-y-1 text-sm ml-4">
                    <li>14-day withdrawal period applies (if no benefits used)</li>
                    <li>Automatic waiver if you use subscriber discounts</li>
                    <li>Recurring monthly billing</li>
                    <li>Cancel anytime through your account</li>
                  </ul>
                </div>

                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">Professor Subscriptions</h3>
                  <ul className="space-y-1 text-sm ml-4">
                    <li>14-day withdrawal period applies (if no benefits used)</li>
                    <li>Automatic waiver if you use professor discounts</li>
                    <li>Recurring monthly billing</li>
                    <li>Independent from platform subscription</li>
                  </ul>
                </div>

                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">Video & Program Purchases</h3>
                  <ul className="space-y-1 text-sm ml-4">
                    <li>14-day withdrawal period applies</li>
                    <li>One-time purchases</li>
                    <li>Lifetime access after purchase</li>
                  </ul>
                </div>

                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">Event Tickets</h3>
                  <ul className="space-y-1 text-sm ml-4">
                    <li>Refund available up to 7 days before event</li>
                    <li>Subject to 10% processing fee</li>
                    <li>No refunds within 7 days of event</li>
                  </ul>
                </div>

                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">Merchandise</h3>
                  <ul className="space-y-1 text-sm ml-4">
                    <li>14-day return period for unopened items</li>
                    <li>Item must be in original condition</li>
                    <li>Return shipping costs paid by customer</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Payment Failures</h2>
              <p className="mb-4">
                If a subscription payment fails:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>We will notify you immediately via email</li>
                <li>You receive a 7-day grace period to update payment information</li>
                <li>Access to your subscription content continues during the grace period</li>
                <li>If payment is not successful within 7 days, subscription is suspended</li>
                <li>No refund is due for the failed payment period</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Processing Times</h2>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <ul className="space-y-2">
                  <li className="flex items-start space-x-2">
                    <Clock className="w-5 h-5 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white">Refund Request:</span>
                      <span className="ml-2">Processed within 24-48 hours</span>
                    </div>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Clock className="w-5 h-5 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white">Bank Processing:</span>
                      <span className="ml-2">5-10 business days to appear in your account</span>
                    </div>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Clock className="w-5 h-5 text-[#B8913D] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white">Refund Method:</span>
                      <span className="ml-2">Original payment method only</span>
                    </div>
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Exceptions</h2>
              <p className="mb-4">Refunds may be denied if:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>The refund request is made after the applicable refund period</li>
                <li>You have used subscription benefits during the withdrawal period (automatic waiver)</li>
                <li>There is evidence of abuse or fraud</li>
                <li>The account has been terminated for violation of Terms of Service</li>
                <li>A chargeback has been initiated with your bank</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Promotional Offers</h2>
              <p>
                If you purchased a subscription at a discounted promotional rate, the refund amount will be based on the actual amount you paid, not the regular price.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">9. Contact Us</h2>
              <p className="mb-4">
                If you have questions about refunds or need assistance with a cancellation, please contact our support team through:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your account dashboard (recommended for fastest response)</li>
                <li>Email support (contact information on website)</li>
                <li>In-platform messaging system</li>
              </ul>
              <p className="mt-4 text-sm text-gray-400">
                Our support team typically responds within 24 hours during business days.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">10. Your Rights</h2>
              <p className="mb-4">
                This refund policy does not affect your statutory rights as a consumer under EU law. If you believe your consumer rights have been violated, you may contact your local consumer protection authority.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
