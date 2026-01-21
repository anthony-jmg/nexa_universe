import { ArrowLeft } from 'lucide-react';
import { BackgroundDecor } from '../components/BackgroundDecor';

interface TermsAndConditionsProps {
  onNavigate: (page: string) => void;
}

export default function TermsAndConditions({ onNavigate }: TermsAndConditionsProps) {
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
            Terms and Conditions
          </h1>
          <p className="text-gray-400 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="space-y-8 text-gray-300">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
              <p className="mb-4">
                Welcome to our Kizomba learning platform. By accessing and using our services, you agree to be bound by these Terms and Conditions. Please read them carefully.
              </p>
              <p>
                These terms govern your use of our website, subscription services, and all content, features, and products we offer.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Services Description</h2>
              <p className="mb-4">We offer the following services:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Platform subscription for access to exclusive content</li>
                <li>Individual professor subscriptions</li>
                <li>Single video purchases</li>
                <li>Complete program purchases</li>
                <li>Event tickets and merchandise</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Account Registration</h2>
              <p className="mb-4">
                To access certain features of our platform, you must create an account. You agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain the security of your password</li>
                <li>Accept all responsibility for activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Subscriptions</h2>
              <p className="mb-4">
                Our subscription services are billed on a recurring monthly basis. By subscribing, you agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Automatic renewal until you cancel</li>
                <li>Charges to your payment method on each billing cycle</li>
                <li>Subscription prices may change with 30 days notice</li>
                <li>Existing subscribers maintain their current price (grandfathering)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Right of Withdrawal (EU)</h2>
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
                <p className="font-semibold mb-2">14-Day Withdrawal Period</p>
                <p>
                  In accordance with EU Directive 2011/83/EU, you have the right to withdraw from your subscription within 14 days of purchase without giving a reason and receive a full refund, provided you have not used any subscription benefits.
                </p>
              </div>
              <p className="mb-4">
                To exercise your right of withdrawal, you must inform us of your decision through your account settings or by contacting our support team.
              </p>
              <p className="mb-4">
                <strong>Important:</strong> If you use any subscription benefits during the withdrawal period (such as subscriber discounts on purchases), you automatically waive your right to withdraw and will not be eligible for a refund. This is in accordance with EU Directive 2011/83/EU Article 16(m).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Cancellation Policy</h2>
              <p className="mb-4">
                You may cancel your subscription at any time through your account settings. When you cancel:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your subscription remains active until the end of the current billing period</li>
                <li>You will not be charged for subsequent periods</li>
                <li>You retain access to content until the expiration date</li>
                <li>After 14 days from purchase, refunds are not provided but access continues until period end</li>
                <li>If you used subscription benefits during the withdrawal period, no refund is available</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Payment Failures</h2>
              <p className="mb-4">
                If a payment fails, we will:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Notify you by email</li>
                <li>Provide a 7-day grace period to update payment information</li>
                <li>Retry the payment during the grace period</li>
                <li>Suspend access if payment is not successful within the grace period</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Content License</h2>
              <p className="mb-4">
                When you purchase or subscribe to content:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You receive a non-exclusive, non-transferable license to access the content</li>
                <li>Content may not be downloaded, copied, or redistributed</li>
                <li>Sharing of account credentials is prohibited</li>
                <li>We reserve the right to revoke access for violations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">9. Intellectual Property</h2>
              <p className="mb-4">
                All content on the platform, including videos, programs, text, graphics, logos, and software, is protected by intellectual property rights and belongs to us or our content creators (professors).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">10. Prohibited Activities</h2>
              <p className="mb-4">You may not:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Use the platform for any illegal purpose</li>
                <li>Attempt to access unauthorized areas</li>
                <li>Interfere with the platform's operation</li>
                <li>Upload malicious code or viruses</li>
                <li>Harass other users or professors</li>
                <li>Impersonate another person or entity</li>
                <li>Abuse the refund system by repeatedly subscribing, using benefits, and requesting refunds</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">11. Anti-Abuse Measures</h2>
              <p className="mb-4">
                To prevent abuse of our refund policy:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Using subscription benefits automatically waives the withdrawal right</li>
                <li>We track and monitor refund patterns</li>
                <li>Accounts showing abuse patterns may be suspended or terminated</li>
                <li>We reserve the right to refuse service to users who abuse our policies</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">12. Limitation of Liability</h2>
              <p className="mb-4">
                To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">13. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the European Union and the laws of the country where our company is registered.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">14. Changes to Terms</h2>
              <p className="mb-4">
                We reserve the right to modify these Terms at any time. We will notify you of significant changes via email or through the platform. Your continued use after changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">15. Contact Information</h2>
              <p>
                If you have questions about these Terms and Conditions, please contact us through the platform's support system or at the contact information provided on our website.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
