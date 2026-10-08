import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import AuthCallback from "@/pages/AuthCallback";
import Checkout from "@/pages/Checkout";
import DashboardLayout from "@/components/DashboardLayout";
import Overview from "@/pages/dashboard/Overview";
import Invoices from "@/pages/dashboard/Invoices";
import Customers from "@/pages/dashboard/Customers";
import Products from "@/pages/dashboard/Products";
import Subscriptions from "@/pages/dashboard/Subscriptions";
import ErpSync from "@/pages/dashboard/ErpSync";
import Listener from "@/pages/dashboard/Listener";
import Settings from "@/pages/dashboard/Settings";

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/pay/:nonce" element={<Checkout />} />
      <Route path="/checkout/:nonce" element={<Checkout />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Overview />} />
          <Route path="/dashboard/invoices" element={<Invoices />} />
          <Route path="/dashboard/customers" element={<Customers />} />
          <Route path="/dashboard/products" element={<Products />} />
          <Route path="/dashboard/subscriptions" element={<Subscriptions />} />
          <Route path="/dashboard/erp-sync" element={<ErpSync />} />
          <Route path="/dashboard/listener" element={<Listener />} />
          <Route path="/dashboard/settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-right" richColors theme="dark" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
