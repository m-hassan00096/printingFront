import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/app/layouts/app-shell";
import { FeaturePlaceholderPage } from "@/app/pages/feature-placeholder-page";
import { FoundationPage } from "@/app/pages/foundation-page";
import { NotFoundPage } from "@/app/pages/not-found-page";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<FoundationPage />} />
          <Route path="orders" element={<FeaturePlaceholderPage featureKey="orders" />} />
          <Route path="production" element={<FeaturePlaceholderPage featureKey="production" />} />
          <Route path="deliveries" element={<FeaturePlaceholderPage featureKey="deliveries" />} />
          <Route path="customers" element={<FeaturePlaceholderPage featureKey="customers" />} />
          <Route path="collections" element={<FeaturePlaceholderPage featureKey="collections" />} />
          <Route path="finance" element={<FeaturePlaceholderPage featureKey="finance" />} />
          <Route path="settings" element={<FeaturePlaceholderPage featureKey="settings" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
