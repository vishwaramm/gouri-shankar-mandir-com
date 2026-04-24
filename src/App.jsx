import { Navigate, Route, Routes } from 'react-router-dom'
import SiteLayout from './components/SiteLayout.jsx'
import AboutPage from './pages/AboutPage.jsx'
import CommunityPage from './pages/CommunityPage.jsx'
import ContactPage from './pages/ContactPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import OrderDetailsPage from './pages/OrderDetailsPage.jsx'
import SignUpPage from './pages/SignUpPage.jsx'
import AccountVerifyEmailPage from './pages/AccountVerifyEmailPage.jsx'
import AccountResetPasswordPage from './pages/AccountResetPasswordPage.jsx'
import BlogPage from './pages/BlogPage.jsx'
import HomePage from './pages/HomePage.jsx'
import PaymentsPage from './pages/PaymentsPage.jsx'
import PriestCustomPaymentPage from './pages/PriestCustomPaymentPage.jsx'
import PriestProfilePage from './pages/PriestProfilePage.jsx'
import PriestPaymentRequestPage from './pages/PriestPaymentRequestPage.jsx'
import PriestReviewPage from './pages/PriestReviewPage.jsx'
import PriestToolsPage from './pages/PriestToolsPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import TermsPage from './pages/TermsPage.jsx'
import RefundPolicyPage from './pages/RefundPolicyPage.jsx'
import EmailConsentPage from './pages/EmailConsentPage.jsx'
import CommunityGuidelinesPage from './pages/CommunityGuidelinesPage.jsx'
import ChildrenPrivacyPage from './pages/ChildrenPrivacyPage.jsx'
import UnsubscribePage from './pages/UnsubscribePage.jsx'
import ServicesPage from './pages/ServicesPage.jsx'
import TrackOrderPage from './pages/TrackOrderPage.jsx'

function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="education" element={<Navigate to="/blog" replace />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="blog" element={<BlogPage />} />
        <Route path="blog/:postId" element={<BlogPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="sign-up" element={<SignUpPage />} />
        <Route path="register" element={<Navigate to="/sign-up" replace />} />
        <Route path="account/reset-password" element={<AccountResetPasswordPage />} />
        <Route path="account/verify-email" element={<AccountVerifyEmailPage />} />
        <Route path="track-order" element={<TrackOrderPage />} />
        <Route path="order/:orderCode" element={<OrderDetailsPage />} />
        <Route path="orders/:orderCode" element={<OrderDetailsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="refund-policy" element={<RefundPolicyPage />} />
        <Route path="email-consent" element={<EmailConsentPage />} />
        <Route path="unsubscribe" element={<UnsubscribePage />} />
        <Route path="community-guidelines" element={<CommunityGuidelinesPage />} />
        <Route path="children-privacy" element={<ChildrenPrivacyPage />} />
        <Route path="admin" element={<Navigate to="/priest-review" replace />} />
        <Route path="priest-review" element={<PriestReviewPage />} />
        <Route path="priest-tools" element={<PriestToolsPage />} />
        <Route path="priest-profile" element={<PriestProfilePage />} />
        <Route path="priest-payment-request" element={<PriestPaymentRequestPage />} />
        <Route path="priest-custom-payment" element={<PriestCustomPaymentPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
