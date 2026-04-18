import { Navigate, Route, Routes } from 'react-router-dom'
import SiteLayout from './components/SiteLayout.jsx'
import AboutPage from './pages/AboutPage.jsx'
import CommunityPage from './pages/CommunityPage.jsx'
import ContactPage from './pages/ContactPage.jsx'
import EducationPage from './pages/EducationPage.jsx'
import HomePage from './pages/HomePage.jsx'
import PaymentsPage from './pages/PaymentsPage.jsx'
import PriestCustomPaymentPage from './pages/PriestCustomPaymentPage.jsx'
import PriestPaymentRequestPage from './pages/PriestPaymentRequestPage.jsx'
import PriestReviewPage from './pages/PriestReviewPage.jsx'
import PriestToolsPage from './pages/PriestToolsPage.jsx'
import ResourcesPage from './pages/ResourcesPage.jsx'
import ServicesPage from './pages/ServicesPage.jsx'

function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="education" element={<EducationPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="priest-review" element={<PriestReviewPage />} />
        <Route path="priest-tools" element={<PriestToolsPage />} />
        <Route path="priest-payment-request" element={<PriestPaymentRequestPage />} />
        <Route path="priest-custom-payment" element={<PriestCustomPaymentPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
